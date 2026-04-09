"use client";

import { AppShell } from "@/components/AppShell";
import { MobileUserMenu } from "@/components/MobileUserMenu";
import { apiGet } from "@/lib/api-client";
import { t } from "@/lib/i18n";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

type AttendanceRow = {
  id: string;
  companyId: string;
  branchId: string | null;
  userId: string;
  checkInAt: string;
  checkInLat: number | null;
  checkInLng: number | null;
  checkInPhoto: string;
  checkOutAt: string | null;
  checkOutLat: number | null;
  checkOutLng: number | null;
  checkOutPhoto: string | null;
  user?: { id: string; email: string | null; name: string | null };
  branch?: { id: string; name: string } | null;
};

export default function AttendancePage() {
  const { data: session } = useSession();
  const locale = session?.user?.locale;
  const role = session?.user?.role;
  const isCashier = role === "CASHIER";
  const qc = useQueryClient();

  const attQ = useQuery({
    queryKey: ["attendance"],
    queryFn: () => apiGet<{ attendances: AttendanceRow[]; open: { id: string; checkInAt: string } | null }>("/api/attendance"),
    staleTime: 5_000
  });

  const open = attQ.data?.open ?? null;
  const last = useMemo(() => {
    if (!attQ.data?.attendances?.length) return null;
    const list = attQ.data.attendances;
    if (isCashier) return list[0] ?? null;
    const myId = session?.user?.id;
    return myId ? list.find((a) => a.userId === myId) ?? null : null;
  }, [attQ.data?.attendances, isCashier, session?.user?.id]);

  const [busy, setBusy] = useState(false);
  const [photoDataUrl, setPhotoDataUrl] = useState<string>("");
  const [preview, setPreview] = useState<string>("");
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [photoModal, setPhotoModal] = useState<{
    open: boolean;
    checkInPhoto?: string;
    checkOutPhoto?: string | null;
  }>({ open: false });
  const [geoNameByKey, setGeoNameByKey] = useState<Record<string, string>>({});

  const title = useMemo(() => (locale === "en" ? "Attendance" : "Kehadiran"), [locale]);

  useEffect(() => {
    return () => {
      // stop camera on unmount
      if (streamRef.current) {
        for (const t of streamRef.current.getTracks()) t.stop();
        streamRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    // attach stream to video after video mounts (also after retake)
    const v = videoRef.current;
    const s = streamRef.current;
    if (!cameraOn || preview || !v || !s) return;
    v.srcObject = s;
    v.play().catch(() => {});
  }, [cameraOn, preview]);

  useEffect(() => {
    // Auto-load approximate location names (avoid spamming: limit + cache)
    const list = attQ.data?.attendances ?? [];
    const keys: { lat: number; lng: number }[] = [];
    for (const a of list) {
      if (a.checkInLat != null && a.checkInLng != null) keys.push({ lat: a.checkInLat, lng: a.checkInLng });
      if (a.checkOutLat != null && a.checkOutLng != null) keys.push({ lat: a.checkOutLat, lng: a.checkOutLng });
    }
    const uniq: { lat: number; lng: number; key: string }[] = [];
    const seen = new Set<string>();
    for (const p of keys) {
      const key = `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (geoNameByKey[key]) continue;
      uniq.push({ ...p, key });
      if (uniq.length >= 12) break; // keep polite to geocoder
    }
    if (!uniq.length) return;

    let cancelled = false;
    (async () => {
      for (const p of uniq) {
        if (cancelled) break;
        await reverseGeocode(p.lat, p.lng);
        // tiny delay to reduce rate limiting
        await new Promise((r) => setTimeout(r, 250));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attQ.data?.attendances]);

  async function reverseGeocode(lat: number, lng: number) {
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    if (geoNameByKey[key]) return geoNameByKey[key];
    try {
      const url = new URL("https://nominatim.openstreetmap.org/reverse");
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("lat", String(lat));
      url.searchParams.set("lon", String(lng));
      url.searchParams.set("zoom", "14");
      url.searchParams.set("addressdetails", "1");
      const res = await fetch(url.toString(), {
        headers: {
          // Nominatim usage policy recommends identifying the application
          "accept": "application/json",
          "accept-language": locale === "en" ? "en" : "id"
        }
      });
      if (!res.ok) throw new Error("geocode_failed");
      const json: any = await res.json();
      const a = json?.address ?? {};
      const parts = [
        a.road || a.pedestrian || a.footway || a.neighbourhood,
        a.suburb || a.village || a.town || a.city_district,
        a.city || a.town || a.village,
        a.state
      ].filter(Boolean);
      const name = parts.length ? parts.join(", ") : (json?.display_name || key);
      setGeoNameByKey((prev) => ({ ...prev, [key]: String(name) }));
      return String(name);
    } catch {
      setGeoNameByKey((prev) => ({ ...prev, [key]: key }));
      return key;
    }
  }

  async function startCamera() {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError(locale === "en" ? "Camera not supported." : "Kamera tidak didukung.");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false
      });
      streamRef.current = stream;
      setCameraOn(true);
    } catch {
      setCameraError(locale === "en" ? "Camera permission denied." : "Izin kamera ditolak.");
      setCameraOn(false);
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      for (const t of streamRef.current.getTracks()) t.stop();
      streamRef.current = null;
    }
    setCameraOn(false);
  }

  function takePhoto() {
    const v = videoRef.current;
    if (!v) return;
    // On some devices, after a retake the element remounts and needs a tick.
    if (!v.videoWidth || !v.videoHeight) {
      window.setTimeout(() => {
        const vv = videoRef.current;
        if (!vv || !vv.videoWidth || !vv.videoHeight) {
          alert(locale === "en" ? "Camera is not ready yet." : "Kamera belum siap.");
          return;
        }
        const w = vv.videoWidth || 640;
        const h = vv.videoHeight || 640;
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(vv, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        setPhotoDataUrl(dataUrl);
        setPreview(dataUrl);
      }, 250);
      return;
    }
    const w = v.videoWidth || 640;
    const h = v.videoHeight || 640;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setPhotoDataUrl(dataUrl);
    setPreview(dataUrl);
  }

  async function getLocation(): Promise<{ lat: number | null; lng: number | null }> {
    if (!("geolocation" in navigator)) return { lat: null, lng: null };
    return await new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve({ lat: null, lng: null }),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  }

  async function submit(kind: "checkin" | "checkout") {
    if (!isCashier) return;
    if (!photoDataUrl) {
      alert(locale === "en" ? "Please take a selfie photo." : "Mohon ambil foto selfie.");
      return;
    }
    setBusy(true);
    try {
      const loc = await getLocation();
      const res = await fetch(`/api/attendance/${kind}`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ photoDataUrl, ...loc })
      });
      if (!res.ok) {
        alert(await res.text());
        return;
      }
      setPhotoDataUrl("");
      setPreview("");
      stopCamera();
      await qc.invalidateQueries({ queryKey: ["attendance"] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <div className="md:hidden">
          <MobileUserMenu />
        </div>
      </div>

      {role === "SUPERADMIN" ? (
        <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-700">
          {locale === "en" ? "Not available for Super Admin." : "Tidak tersedia untuk Super Admin."}
        </div>
      ) : null}

      {isCashier ? (
        <section className="mt-4 rounded-2xl border border-neutral-200 bg-white/80 p-4 shadow-sm backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm font-semibold text-neutral-900">
              {open
                ? locale === "en"
                  ? "You are checked in"
                  : "Anda sudah check-in"
                : locale === "en"
                  ? "Not checked in"
                  : "Belum check-in"}
            </div>
            <div className="text-xs text-neutral-500">
              {open ? new Date(open.checkInAt).toLocaleString() : null}
            </div>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-[1fr_220px]">
            <div className="rounded-2xl border border-neutral-200 bg-white p-3">
              <div className="text-sm font-semibold text-neutral-900">
                {locale === "en" ? "Selfie photo" : "Foto selfie"}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className="rounded-xl bg-[#469d98] px-4 py-3 text-sm font-semibold text-white hover:bg-[#3f8f8a] disabled:opacity-60"
                  style={{ minHeight: 44 }}
                  disabled={busy || cameraOn}
                  onClick={startCamera}
                >
                  {locale === "en" ? "Open camera" : "Buka kamera"}
                </button>
              </div>

              {cameraError ? (
                <div className="mt-2 text-sm text-red-700">{cameraError}</div>
              ) : null}

              {cameraOn && !preview ? (
                <div className="relative mt-3 overflow-hidden rounded-2xl border border-neutral-200 bg-black">
                  <video
                    ref={videoRef}
                    className="h-auto w-full"
                    playsInline
                    muted
                    autoPlay
                  />
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-black/40 p-2">
                    <button
                      className="rounded-xl bg-white/90 px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-white disabled:opacity-60"
                      style={{ minHeight: 40 }}
                      disabled={busy}
                      onClick={stopCamera}
                    >
                      {locale === "en" ? "Close" : "Tutup"}
                    </button>
                    <button
                      className="rounded-xl bg-[#469d98] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3f8f8a] disabled:opacity-60"
                      style={{ minHeight: 40 }}
                      disabled={busy}
                      onClick={takePhoto}
                    >
                      {locale === "en" ? "Capture" : "Ambil foto"}
                    </button>
                  </div>
                </div>
              ) : null}
              {preview ? (
                <div className="relative mt-3 overflow-hidden rounded-2xl border border-neutral-200">
                  <Image
                    src={preview}
                    alt="Selfie preview"
                    width={640}
                    height={640}
                    className="h-auto w-full"
                  />
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-black/40 p-2">
                    <button
                      className="rounded-xl border border-white/30 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/20 disabled:opacity-60"
                      style={{ minHeight: 40 }}
                      disabled={busy}
                      onClick={() => {
                        setPhotoDataUrl("");
                        setPreview("");
                        if (!streamRef.current) startCamera();
                      }}
                    >
                      {locale === "en" ? "Retake" : "Ulang"}
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        className="rounded-xl bg-[#469d98] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3f8f8a] disabled:opacity-60"
                        style={{ minHeight: 40 }}
                        disabled={busy || Boolean(open)}
                        onClick={() => submit("checkin")}
                      >
                        {locale === "en" ? "Check in" : "Check-in"}
                      </button>
                      <button
                        className="rounded-xl border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20 disabled:opacity-60"
                        style={{ minHeight: 40 }}
                        disabled={busy || !open}
                        onClick={() => submit("checkout")}
                      >
                        {locale === "en" ? "Check out" : "Check-out"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-3 text-sm text-neutral-600">
                  {locale === "en"
                    ? "Use your camera to take a selfie."
                    : "Gunakan kamera untuk mengambil selfie."}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white p-3">
              <div className="mt-2 text-xs text-neutral-500">
                {locale === "en"
                  ? "Location + timestamp will be recorded."
                  : "Lokasi + waktu akan dicatat."}
              </div>
              <div className="mt-2 text-sm font-semibold text-neutral-900">
                {open
                  ? locale === "en"
                    ? "Status: checked in"
                    : "Status: sudah check-in"
                  : locale === "en"
                    ? "Status: not checked in"
                    : "Status: belum check-in"}
              </div>
              <div className="mt-3 grid gap-1 text-xs font-semibold text-neutral-600">
                <div className="flex items-center justify-between gap-3">
                  <span>{locale === "en" ? "Last check-in" : "Check-in terakhir"}</span>
                  <span className="text-neutral-900">
                    {last?.checkInAt ? new Date(last.checkInAt).toLocaleString() : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>{locale === "en" ? "Last check-out" : "Check-out terakhir"}</span>
                  <span className="text-neutral-900">
                    {last?.checkOutAt ? new Date(last.checkOutAt).toLocaleString() : "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-700">
          {locale === "en"
            ? "Admins/Owners don’t need to check in/out. This page is for viewing attendance."
            : "Admin/Owner tidak perlu check-in/check-out. Halaman ini untuk melihat kehadiran."}
        </div>
      )}

      <section className="mt-4 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
        <div className="grid grid-cols-[1.2fr_1fr_1fr] gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold text-neutral-600">
          <div>{locale === "en" ? "User / Branch" : "User / Cabang"}</div>
          <div className="text-right">{locale === "en" ? "Check-in" : "Check-in"}</div>
          <div className="text-right">{locale === "en" ? "Check-out" : "Check-out"}</div>
        </div>

        {attQ.isLoading ? (
          <div className="p-4 text-sm text-neutral-600">{t(locale, "menu.loading")}</div>
        ) : (
          <div className="divide-y divide-neutral-200">
            {(attQ.data?.attendances ?? []).map((a) => (
              <div key={a.id} className="px-4 py-3">
                <div className="grid grid-cols-[1.2fr_1fr_1fr] items-start gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-neutral-900">
                          {a.user?.name ?? a.user?.email ?? a.userId.slice(0, 8)}
                        </div>
                        <div className="mt-0.5 truncate text-xs text-neutral-500">
                          {a.branch?.name ?? "—"}
                        </div>
                      </div>
                      <button
                        className="inline-flex rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-900 hover:bg-neutral-50"
                        style={{ minHeight: 36 }}
                        onClick={() =>
                          setPhotoModal({
                            open: true,
                            checkInPhoto: a.checkInPhoto,
                            checkOutPhoto: a.checkOutPhoto
                          })
                        }
                      >
                        {locale === "en" ? "View photo" : "Lihat foto"}
                      </button>
                    </div>
                  </div>
                  <div className="text-right text-xs font-semibold text-neutral-700">
                    {new Date(a.checkInAt).toLocaleString()}
                    <div className="mt-0.5 text-[11px] font-medium text-neutral-500">
                      {a.checkInLat && a.checkInLng
                        ? geoNameByKey[`${a.checkInLat.toFixed(4)},${a.checkInLng.toFixed(4)}`] ??
                          `${a.checkInLat.toFixed(5)}, ${a.checkInLng.toFixed(5)}`
                        : "—"}
                    </div>
                  </div>
                  <div className="text-right text-xs font-semibold text-neutral-700">
                    {a.checkOutAt ? new Date(a.checkOutAt).toLocaleString() : "—"}
                    <div className="mt-0.5 text-[11px] font-medium text-neutral-500">
                      {a.checkOutLat && a.checkOutLng
                        ? geoNameByKey[`${a.checkOutLat.toFixed(4)},${a.checkOutLng.toFixed(4)}`] ??
                          `${a.checkOutLat.toFixed(5)}, ${a.checkOutLng.toFixed(5)}`
                        : "—"}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {(attQ.data?.attendances?.length ?? 0) === 0 ? (
              <div className="p-4 text-sm text-neutral-600">
                {locale === "en" ? "No attendance yet." : "Belum ada data kehadiran."}
              </div>
            ) : null}
          </div>
        )}
      </section>

      {photoModal.open ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-3 md:items-center">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between gap-3 border-b border-neutral-200 p-4">
              <div className="text-sm font-semibold text-neutral-900">
                {locale === "en" ? "Attendance photos" : "Foto kehadiran"}
              </div>
              <button
                className="rounded-xl border border-neutral-200 px-3 py-2 text-sm font-semibold"
                style={{ minHeight: 44 }}
                onClick={() => setPhotoModal({ open: false })}
              >
                {t(locale, "common.close")}
              </button>
            </div>
            <div className="grid gap-3 p-4 md:grid-cols-2">
              <div>
                <div className="text-xs font-semibold text-neutral-500">
                  {locale === "en" ? "Check-in" : "Check-in"}
                </div>
                {photoModal.checkInPhoto ? (
                  <div className="mt-2 overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50">
                    <Image
                      src={photoModal.checkInPhoto}
                      alt="Check-in photo"
                      width={900}
                      height={900}
                      className="h-auto w-full"
                    />
                  </div>
                ) : (
                  <div className="mt-2 text-sm text-neutral-600">—</div>
                )}
              </div>
              <div>
                <div className="text-xs font-semibold text-neutral-500">
                  {locale === "en" ? "Check-out" : "Check-out"}
                </div>
                {photoModal.checkOutPhoto ? (
                  <div className="mt-2 overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50">
                    <Image
                      src={photoModal.checkOutPhoto}
                      alt="Check-out photo"
                      width={900}
                      height={900}
                      className="h-auto w-full"
                    />
                  </div>
                ) : (
                  <div className="mt-2 text-sm text-neutral-600">—</div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}

