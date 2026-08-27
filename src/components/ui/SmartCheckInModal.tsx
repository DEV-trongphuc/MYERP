import React, { useState, useEffect, useRef } from 'react';
import { Camera, AlertTriangle, CheckCircle2, Clock, Sparkles, RefreshCw, X, Fingerprint, MapPin, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CustomModal } from './CustomModal';
import { useLanguage } from '../../contexts/LanguageContext';
import { fetchAPI } from '../../utils/api';
import toast from 'react-hot-toast';

// Module-level in-memory cache for ultra-fast location and address retrieval (0ms retrieval if recent)
let globalCachedGPS: { coords: { latitude: number; longitude: number }; timestamp: number } | null = null;
const globalAddressCache = new Map<string, string>();

// Singleton canvas for fast facial skin-detection heuristic (eliminates GC pause & memory allocation churn)
let detectionCanvas: HTMLCanvasElement | null = null;
let detectionCtx: CanvasRenderingContext2D | null = null;

// Global helper to pre-warm GPS satellite / network location on user interactions (hover, login, click)
export const prewarmSmartCheckInGPS = () => {
  if (typeof window === 'undefined' || !navigator.geolocation) return;
  if (globalCachedGPS && Date.now() - globalCachedGPS.timestamp < 60000) return;
  try {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        globalCachedGPS = {
          coords: { latitude: pos.coords.latitude, longitude: pos.coords.longitude },
          timestamp: Date.now()
        };
      },
      () => {},
      { enableHighAccuracy: true, timeout: 4000, maximumAge: 60000 }
    );
  } catch (e) {}
};

interface SmartCheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  todayCheckIn: any;
  consultantProfile: any;
  user: any;
  onCheckInSuccess: () => void;
  requireCheckout?: boolean;
}

export const SmartCheckInModal: React.FC<SmartCheckInModalProps> = ({
  isOpen,
  onClose,
  todayCheckIn,
  consultantProfile,
  user,
  onCheckInSuccess,
  requireCheckout = false
}) => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState('');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [checkInReason, setCheckInReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Scanner & AI Auto Detection States
  const [faceScanProgress, setFaceScanProgress] = useState(0);
  const [scanStatusText, setScanStatusText] = useState('');

  // Success Screen State
  const [isSuccessScreen, setIsSuccessScreen] = useState(false);
  const [successMeta, setSuccessMeta] = useState<any>(null);

  const [currentAddress, setCurrentAddress] = useState<string>('');
  const [addressLoading, setAddressLoading] = useState<boolean>(false);
  const [locationError, setLocationError] = useState<string>('');
  const [gpsCoords, setGpsCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchLocation();
    } else {
      setCurrentAddress('');
      setLocationError('');
      setGpsCoords(null);
      setAddressLoading(false);
    }
  }, [isOpen]);

  // Non-blocking Reverse Geocoding with local memory caching & 1.4s strict timeout
  const reverseGeocodeNonBlocking = (coords: { latitude: number; longitude: number }) => {
    const cacheKey = `${coords.latitude.toFixed(4)},${coords.longitude.toFixed(4)}`;
    if (globalAddressCache.has(cacheKey)) {
      setCurrentAddress(globalAddressCache.get(cacheKey)!);
      setAddressLoading(false);
      return;
    }

    setAddressLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1400);

    const geoUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.latitude}&lon=${coords.longitude}&accept-language=vi`;
    fetch(geoUrl, {
      signal: controller.signal,
      headers: {
        'Accept-Language': 'vi',
        'User-Agent': 'IdeasCRM/1.0'
      }
    })
      .then(async (res) => {
        if (res.ok) {
          const geoData = await res.json();
          const addr = geoData.display_name || `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`;
          globalAddressCache.set(cacheKey, addr);
          setCurrentAddress(addr);
        } else {
          setCurrentAddress(`${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`);
        }
      })
      .catch(() => {
        // Fallback gracefully without blocking checkin
        setCurrentAddress(`${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`);
      })
      .finally(() => {
        clearTimeout(timer);
        setAddressLoading(false);
      });
  };

  const fetchLocation = () => {
    setLocationError('');

    // 1. Instant Cache hit (< 10ms)
    if (globalCachedGPS && Date.now() - globalCachedGPS.timestamp < 120000) {
      setGpsCoords(globalCachedGPS.coords);
      reverseGeocodeNonBlocking(globalCachedGPS.coords);
    }

    if (!navigator.geolocation) {
      setLocationError(t('Trình duyệt của bạn không hỗ trợ định vị GPS.'));
      setAddressLoading(false);
      return;
    }

    // 2. Progressive Geolocation: High accuracy with fast fallback
    const onLocationSuccess = (position: GeolocationPosition) => {
      const coords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      };
      globalCachedGPS = { coords, timestamp: Date.now() };
      setGpsCoords(coords);
      setLocationError('');
      reverseGeocodeNonBlocking(coords);
    };

    navigator.geolocation.getCurrentPosition(
      onLocationSuccess,
      (error) => {
        // Retry with lower accuracy / cell triangulation if high accuracy times out
        navigator.geolocation.getCurrentPosition(
          onLocationSuccess,
          (err2) => {
            if (!globalCachedGPS) {
              let msg = t('Không thể lấy vị trí GPS. Vui lòng bật định vị.');
              if (err2.code === err2.PERMISSION_DENIED || error.code === error.PERMISSION_DENIED) {
                msg = t('Vui lòng cấp quyền truy cập vị trí (GPS) trên trình duyệt để chấm công.');
              }
              setLocationError(msg);
              setAddressLoading(false);
            }
          },
          { enableHighAccuracy: false, timeout: 3500, maximumAge: 180000 }
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 4000,
        maximumAge: 60000
      }
    );
  };

  const videoRef = useRef<HTMLVideoElement>(null);
  const autoCapturedRef = useRef(false);

  const [isManualMode, setIsManualMode] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const now = new Date();
  const curHM = now.toTimeString().substring(0, 5); 
  let currentDayOfWeek = now.getDay();
  if (currentDayOfWeek === 0) currentDayOfWeek = 7;
  
  const currentDayConfig = consultantProfile?.work_schedule?.[String(currentDayOfWeek)] || 
                    consultantProfile?.work_schedule?.[currentDayOfWeek] ||
                    user?.work_schedule?.[String(currentDayOfWeek)] ||
                    user?.work_schedule?.[currentDayOfWeek];
                    
  const isTodayDayOff = Boolean(currentDayConfig && currentDayConfig.active === false);
  const morningShiftStart = String(currentDayConfig?.start || consultantProfile?.work_start_time || user?.work_start_time || '08:00').substring(0, 5);
  const afternoonShiftEnd = String(currentDayConfig?.end_afternoon || currentDayConfig?.end || consultantProfile?.work_end_time || user?.work_end_time || '17:30').substring(0, 5);

  const isCheckOutMode = !!(requireCheckout && todayCheckIn && todayCheckIn.status !== 'rejected' && !todayCheckIn.check_out_time);
  const isBeforeMorningStart = curHM < morningShiftStart;
  const isAfterShiftEnd = !isTodayDayOff && curHM >= afternoonShiftEnd;

  // Chặn ra ca trước khi ca sáng bắt đầu
  const isBlockedEarlyCheckOut = isCheckOutMode && isBeforeMorningStart;
  // Chặn vào ca sau khi đã quá giờ tan ca hôm nay
  const isBlockedLateCheckIn = !isCheckOutMode && (!todayCheckIn || todayCheckIn.status === 'rejected') && isAfterShiftEnd;

  const checkIsLate = () => {
    if (isTodayDayOff) return false; 
    
    const workStart = currentDayConfig?.start || consultantProfile?.work_start_time || '08:00';
    const morningEnd = currentDayConfig?.end || '12:00';
    const afternoonStart = currentDayConfig?.start_afternoon || '13:00';
    
    if (curHM > morningEnd) {
      if (!currentDayConfig?.start_afternoon && !currentDayConfig?.end_afternoon) {
        return curHM > workStart;
      }
      return curHM > afternoonStart;
    } else {
      return curHM > workStart;
    }
  };

  const getMinutesLate = () => {
    if (isTodayDayOff) return 0; 
    
    const workStart = currentDayConfig?.start || consultantProfile?.work_start_time || '08:00';
    const morningEnd = currentDayConfig?.end || '12:00';
    const afternoonStart = currentDayConfig?.start_afternoon || '13:00';
    
    let startHM = workStart;
    if (curHM > morningEnd) {
      if (currentDayConfig?.start_afternoon || currentDayConfig?.end_afternoon) {
        startHM = afternoonStart;
      }
    }
    
    const [startH, startM] = startHM.split(':').map(Number);
    const currentH = now.getHours();
    const currentM = now.getMinutes();
    const startTotal = startH * 60 + startM;
    const currentTotal = currentH * 60 + currentM;
    return Math.max(0, currentTotal - startTotal);
  };

  const isLate = isCheckOutMode ? false : checkIsLate();
  const minutesLate = isCheckOutMode ? 0 : getMinutesLate();

  // Camera Control
  const startCamera = async () => {
    setCameraError('');
    setCapturedImage(null);
    setCapturedBlob(null);
    setIsManualMode(false);
    autoCapturedRef.current = false;
    setFaceScanProgress(0);
    setScanStatusText(t('Vui lòng đưa khuôn mặt vào khung hình...'));

    try {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
      
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false
        });
      } catch (e1) {
        console.warn("Camera ideal constraint failed, retrying simple video constraint:", e1);
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
      }

      setCameraStream(stream);
      setIsCameraActive(true);
    } catch (err: any) {
      console.error("Camera access error:", err);
      setCameraError(t('Không thể truy cập camera. Vui lòng cấp quyền camera trong trình duyệt để chấm công.'));
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setIsCameraActive(false);
  };

  // Ensure camera stream is assigned to video element when stream or element becomes available
  useEffect(() => {
    if (cameraStream && videoRef.current) {
      const video = videoRef.current;
      video.srcObject = cameraStream;
      video.setAttribute('playsinline', 'true');
      video.setAttribute('autoplay', 'true');
      video.muted = true;
      video.play().catch(err => console.log('Camera video play error:', err));
    }
  }, [cameraStream, isCameraActive]);

  // Start camera automatically when modal opens
  useEffect(() => {
    if (isOpen && (!todayCheckIn || todayCheckIn.status === 'rejected' || isCheckOutMode) && !isSuccessScreen && !isBlockedEarlyCheckOut && !isBlockedLateCheckIn) {
      startCamera();
    } else if (!isOpen || isBlockedEarlyCheckOut || isBlockedLateCheckIn) {
      stopCamera();
      setCapturedImage(null);
      setCapturedBlob(null);
      setIsManualMode(false);
      setCheckInReason('');
      setIsSuccessScreen(false);
      setFaceScanProgress(0);
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, todayCheckIn, isSuccessScreen, isCheckOutMode, isBlockedEarlyCheckOut, isBlockedLateCheckIn]);

  // Single-pass direct WebP snapshot & preview generator (Ultra-fast, 0 re-encoding)
  const takeSnapshotDirect = (): Promise<{ dataUrl: string; blob: Blob } | null> => {
    if (!videoRef.current) return Promise.resolve(null);
    const video = videoRef.current;
    const width = video.videoWidth || video.clientWidth || 640;
    const height = video.videoHeight || video.clientHeight || 480;
    if (width === 0 || height === 0) return Promise.resolve(null);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return Promise.resolve(null);

    ctx.drawImage(video, 0, 0, width, height);

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          if (blob) {
            resolve({ dataUrl, blob });
          } else {
            resolve({ dataUrl, blob: new Blob([]) });
          }
        },
        'image/webp',
        0.78
      );
    });
  };

  const handleManualCapture = async () => {
    if (!isManualMode) {
      setIsManualMode(true);
      setScanStatusText(t('Chế độ chụp ảnh thủ công'));
      return;
    }

    const snap = await takeSnapshotDirect();
    if (snap) {
      setCapturedImage(snap.dataUrl);
      setCapturedBlob(snap.blob);
      stopCamera();
      if (!isLate) {
        submitCheckIn(snap.dataUrl, snap.blob);
      }
    } else {
      toast.error(t('Chưa nhận được khung hình camera. Vui lòng thử lại.'));
    }
  };

  // Ultra-fast AI Face Detection & Auto Capture Loop (140ms tick, singleton canvas)
  useEffect(() => {
    if (!isCameraActive || capturedImage || isSuccessScreen || autoCapturedRef.current || isManualMode) {
      return;
    }

    let intervalId: any;
    let isDetecting = false;

    if (!detectionCanvas) {
      detectionCanvas = document.createElement('canvas');
      detectionCanvas.width = 100;
      detectionCanvas.height = 75;
      detectionCtx = detectionCanvas.getContext('2d', { willReadFrequently: true });
    }

    const detectFaceFrame = async () => {
      if (isDetecting || autoCapturedRef.current || !videoRef.current) return;
      isDetecting = true;

      const video = videoRef.current;
      if (video.readyState >= 2 && video.videoWidth > 0) {
        let detected = false;
        let detectionConfidence = 35; // progress jump per tick

        // 1. Native FaceDetector API (Chrome / Edge / Android) -> ultra fast (15ms)
        if ('FaceDetector' in window) {
          try {
            const detector = new (window as any).FaceDetector({ fastMode: true, maxFaces: 1 });
            const faces = await detector.detect(video);
            if (faces && faces.length > 0) {
              detected = true;
              detectionConfidence = 40;
            }
          } catch (e) {}
        }

        // 2. Luminance & Face Skin-density Heuristic using singleton canvas
        if (!detected && detectionCtx) {
          try {
            detectionCtx.drawImage(video, 0, 0, 100, 75);
            const imgData = detectionCtx.getImageData(25, 12, 50, 50);
            const data = imgData.data;
            let skinPixelCount = 0;
            for (let i = 0; i < data.length; i += 4) {
              const r = data[i], g = data[i+1], b = data[i+2];
              if (r > 60 && g > 40 && b > 20 && r > g && r > b && (Math.max(r, g, b) - Math.min(r, g, b) > 15)) {
                skinPixelCount++;
              }
            }
            if (skinPixelCount > (data.length / 4) * 0.12) {
              detected = true;
              detectionConfidence = 35;
            }
          } catch (e) {}
        }

        if (detected) {
          setFaceScanProgress(prev => {
            const next = prev + detectionConfidence;
            if (next >= 100 && !autoCapturedRef.current) {
              autoCapturedRef.current = true;
              setScanStatusText(t('Đã phát hiện khuôn mặt! Đang tự động chụp...'));
              
              setTimeout(async () => {
                const snap = await takeSnapshotDirect();
                if (snap) {
                  setCapturedImage(snap.dataUrl);
                  setCapturedBlob(snap.blob);
                  stopCamera();
                  if (!isCheckOutMode) {
                    submitCheckIn(snap.dataUrl, snap.blob);
                  } else {
                    setScanStatusText(t('Đã nhận diện khuôn mặt! Vui lòng nhấn nút Xác nhận Ra ca bên dưới để hoàn tất.'));
                  }
                }
              }, 60);
              return 100;
            }
            setScanStatusText(t('Đã tìm thấy khuôn mặt... Giữ yên!'));
            return next;
          });
        } else {
          setFaceScanProgress(prev => Math.max(0, prev - 15));
          setScanStatusText(t('Đưa khuôn mặt vào hình bầu dục...'));
        }
      }
      isDetecting = false;
    };

    intervalId = setInterval(detectFaceFrame, 140);

    return () => {
      clearInterval(intervalId);
    };
  }, [isCameraActive, capturedImage, isSuccessScreen, isLate, isCheckOutMode]);

  // Submit Check-in API (Ultra-optimized single-pass upload, non-blocking GPS)
  const submitCheckIn = async (overrideImage?: string, overrideBlob?: Blob | null) => {
    if (isBlockedEarlyCheckOut) {
      toast.error(t(`Không thể chấm công Ra ca trước khi ca làm việc bắt đầu (${morningShiftStart}).`));
      return;
    }

    if (isBlockedLateCheckIn) {
      toast.error(t(`Đã quá giờ tan ca hôm nay (${afternoonShiftEnd}). Vui lòng tạo phiếu Cập nhật / Giải trình công để Quản lý phê duyệt.`));
      return;
    }

    const imageToUse = overrideImage || capturedImage;
    const blobToUse = overrideBlob !== undefined ? overrideBlob : capturedBlob;

    if (!imageToUse || submitting) return;

    if (isCheckOutMode) {
      const ok = window.confirm(t('Bạn có chắc chắn muốn Chấm công Ra ca kết thúc ca làm việc hôm nay không?'));
      if (!ok) {
        setSubmitting(false);
        return;
      }
    }

    setSubmitting(true);
    const coords = gpsCoords;
    const addressStr = currentAddress || (coords ? `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}` : '');

    try {
      let webpBlob = blobToUse;
      if (!webpBlob || webpBlob.size === 0) {
        // Fallback single-pass conversion if blob was not passed
        const compressToWebP = (dataUrl: string): Promise<Blob> => {
          return new Promise((resolve, reject) => {
            const img = new Image();
            img.src = dataUrl;
            img.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(img, 0, 0);
                canvas.toBlob((b) => {
                  if (b) resolve(b);
                  else reject(new Error('WebP conversion failed'));
                }, 'image/webp', 0.78);
              } else {
                reject(new Error('Canvas context error'));
              }
            };
            img.onerror = () => reject(new Error('Image loading error'));
          });
        };
        webpBlob = await compressToWebP(imageToUse);
      }

      const file = new File([webpBlob], `selfie_${Date.now()}.webp`, { type: 'image/webp' });
      const formData = new FormData();
      formData.append('file', file);
      
      const uploadRes = await fetchAPI('upload', {
        method: 'POST',
        body: formData
      });

      if (!uploadRes.success || !uploadRes.data?.url) {
        toast.error(uploadRes.message || t('Lỗi tải ảnh lên'));
        setSubmitting(false);
        return;
      }

      const res = await fetchAPI('check-ins', {
        method: 'POST',
        body: JSON.stringify({
          selfie_url: uploadRes.data.url,
          checkout_selfie_url: uploadRes.data.url,
          action: isCheckOutMode ? 'checkout' : 'checkin',
          checkout: isCheckOutMode ? 1 : 0,
          reason: isLate ? checkInReason : null,
          latitude: coords?.latitude?.toString() || '',
          longitude: coords?.longitude?.toString() || '',
          location_address: addressStr
        })
      });

      if (res.success) {
        stopCamera();
        const now = new Date();
        const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        const dateStr = now.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

        setSuccessMeta({ time: timeStr, date: dateStr, isLate, isCheckOut: isCheckOutMode });
        setIsSuccessScreen(true);

        onCheckInSuccess();

        // Auto close modal after 1s
        setTimeout(() => {
          setIsSuccessScreen(false);
          onClose();
        }, 1000);
      } else {
        toast.error(res.message || t('Check-in thất bại'));
      }
    } catch (err: any) {
      toast.error(t('Lỗi check-in: ') + err.message);
    }
    setSubmitting(false);
  };

  const circumference = 2 * Math.PI * 135; // r = 135
  const strokeDashoffset = circumference - (circumference * faceScanProgress) / 100;

  return (
    <CustomModal
      isOpen={isOpen}
      onClose={onClose}
      title={isSuccessScreen ? '' : (
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Fingerprint size={20} color="#BD1D2D" />
          <span>{isCheckOutMode ? t("CHẤM CÔNG RA CA") : t("CHẤM CÔNG HÀNG NGÀY")}</span>
        </span>
      )}
      width="100%"
      maxWidth="500px"
      fullScreenOnMobile={false}
      modalClassName="checkin-modal-dark"
    >
      {/* 1. Blocked Early Check-Out State */}
      {isBlockedEarlyCheckOut && !isSuccessScreen ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: isMobile ? '70dvh' : 'auto',
          gap: '1.5rem',
          padding: '2rem 1.5rem',
          textAlign: 'center'
        }}>
          <div style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.12)',
            color: 'var(--color-danger)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2.5rem',
            boxShadow: '0 8px 24px rgba(239, 68, 68, 0.15)'
          }}>
            <AlertTriangle size={38} color="#ef4444" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-text)' }}>
              {t('Chưa đến giờ bắt đầu ca làm việc')}
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: '8px 0 0', lineHeight: 1.5 }}>
              {t(`Bạn không thể thực hiện Chấm công Ra ca trước khi ca sáng bắt đầu (${morningShiftStart}). Vui lòng quay lại sau khi đã vào ca làm việc.`)}
            </p>
          </div>
          <button 
            className="btn outline" 
            onClick={onClose} 
            style={{ borderRadius: '24px', padding: '10px 32px', fontWeight: 700 }}
          >
            {t('Đã hiểu')}
          </button>
        </div>
      ) : isBlockedLateCheckIn && !isSuccessScreen ? (
        /* 2. Blocked Late Check-In State -> Prompt to Create Attendance Update */
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: isMobile ? '70dvh' : 'auto',
          gap: '1.5rem',
          padding: '2rem 1.5rem',
          textAlign: 'center'
        }}>
          <div style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            background: 'rgba(139, 92, 246, 0.15)',
            color: '#7c3aed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2.5rem',
            boxShadow: '0 8px 24px rgba(124, 58, 237, 0.2)'
          }}>
            <FileText size={38} color="#7c3aed" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-text)' }}>
              {t('Đã quá giờ tan ca hôm nay')}
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: '8px 0 0', lineHeight: 1.5 }}>
              {t(`Ca làm việc hôm nay đã kết thúc lúc ${afternoonShiftEnd}. Bạn không thể chấm công vào ca trực tiếp mà cần tạo phiếu Cập nhật / Giải trình công để Quản lý phê duyệt.`)}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button 
              className="btn outline" 
              onClick={onClose} 
              style={{ borderRadius: '24px', padding: '10px 20px', fontWeight: 600 }}
            >
              {t('Đóng')}
            </button>
            <button 
              onClick={() => {
                onClose();
                const todayStr = new Date().toISOString().split('T')[0];
                navigate(`/approvals?create=attendance_bulk&date=${todayStr}`);
              }} 
              style={{ 
                background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', 
                color: '#ffffff', 
                border: 'none', 
                borderRadius: '24px', 
                padding: '10px 24px', 
                fontWeight: 700, 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px',
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(124, 58, 237, 0.35)'
              }}
            >
              <FileText size={16} />
              <span>{t('Tạo phiếu Cập nhật công ngay')}</span>
            </button>
          </div>
        </div>
      ) : todayCheckIn && todayCheckIn.status !== 'rejected' && (!requireCheckout || todayCheckIn.check_out_time) && !isSuccessScreen ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: isMobile ? '70dvh' : 'auto',
          gap: '1.5rem',
          padding: '1.5rem 1rem',
          textAlign: 'center'
        }}>
          <div style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            background: todayCheckIn.check_out_time ? 'rgba(59, 130, 246, 0.12)' : todayCheckIn.status === 'approved' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
            color: todayCheckIn.check_out_time ? 'var(--color-primary)' : todayCheckIn.status === 'approved' ? 'var(--color-success)' : 'var(--color-warning)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2.5rem',
            fontWeight: 'bold',
            boxShadow: todayCheckIn.check_out_time ? '0 8px 24px rgba(59, 130, 246, 0.15)' : '0 8px 24px rgba(16, 185, 129, 0.15)'
          }}>
            {todayCheckIn.check_out_time ? <CheckCircle2 size={38} color="#2563eb" /> : todayCheckIn.status === 'approved' ? <CheckCircle2 size={38} /> : <Clock size={38} />}
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-text)' }}>
              {todayCheckIn.check_out_time 
                ? t('Đã Hoàn thành Ngày làm việc') 
                : todayCheckIn.status === 'approved' 
                  ? t('Đã Chấm công Thành công') 
                  : t('Đang chờ phê duyệt đi trễ')}
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: '6px 0 0' }}>
              {todayCheckIn.check_out_time 
                ? `${t('Vào:')} ${todayCheckIn.check_in_time.substring(0, 5)} • ${t('Ra:')} ${(todayCheckIn.check_out_time.substring(11, 16) || todayCheckIn.check_out_time.substring(0, 5))}`
                : `${t('Thời gian chấm công:')} ${todayCheckIn.check_in_time ? todayCheckIn.check_in_time.substring(0, 5) : ''}`} ngày {todayCheckIn.check_in_date}
            </p>
          </div>
          {todayCheckIn.reason && (
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-light)', margin: 0, fontStyle: 'italic', background: 'var(--color-bg)', padding: '8px 16px', borderRadius: '8px', border: '1px dashed var(--color-border)' }}>
              "{todayCheckIn.reason}"
            </p>
          )}
          <button className="btn primary" onClick={onClose} style={{ backgroundColor: '#BD1D2D', border: 'none', borderRadius: '24px', padding: '10px 32px', fontWeight: 600, marginTop: '0.5rem' }}>
            {t('Đồng ý')}
          </button>
        </div>
      ) : isSuccessScreen ? (
        /* 2. Stunning Success Screen (Auto Closes after 2s) */
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: isMobile ? '70dvh' : 'auto',
          padding: '2.5rem 1.5rem',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Animated Glowing Ring Aura */}
          <div style={{ position: 'relative', width: 90, height: 90, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="checkin-pulse-ring" />
            <div 
              className="checkin-success-badge"
              style={{
                width: 84,
                height: 84,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 12px 30px rgba(16, 185, 129, 0.4)',
                zIndex: 2
              }}
            >
              <CheckCircle2 size={46} strokeWidth={2.5} />
            </div>
          </div>

          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-text)', margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>
            {successMeta?.isCheckOut ? t('CHẤM CÔNG RA CA THÀNH CÔNG!') : t('CHẤM CÔNG THÀNH CÔNG!')}
          </h2>
          
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: '0 0 1.25rem 0', maxWidth: '340px', lineHeight: 1.5 }}>
            {successMeta?.isCheckOut 
              ? t('Hẹn gặp lại bạn vào ca làm việc tiếp theo. Chúc bạn một buổi tối vui vẻ!')
              : successMeta?.isLate 
                ? t('Yêu cầu đi trễ đã gửi tới quản lý. Đã ghi nhận thời gian chấm công!')
                : t('Cổng nhận data tự động hôm nay đã mở. Chúc bạn giao dịch chốt cọc bùng nổ!')}
          </p>

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 16px',
            borderRadius: '20px',
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            color: '#10b981',
            fontSize: '0.8125rem',
            fontWeight: 700,
            marginBottom: '2rem'
          }}>
            <Clock size={15} />
            <span>{successMeta?.time || ''} • {successMeta?.date || ''}</span>
          </div>

          {/* 1s Animated Countdown Progress Bar */}
          <div style={{ width: '100%', maxWidth: '260px', height: 4, background: 'var(--color-border-light)', borderRadius: 99, overflow: 'hidden', margin: '0 auto 1.5rem auto' }}>
            <div className="checkin-progress-bar" style={{ height: '100%', background: 'linear-gradient(90deg, #10b981, #059669)', borderRadius: 99, animation: 'checkin-progress-fill 1s linear forwards' }} />
          </div>
        </div>
      ) : (
        /* 3. Main Scanner & Camera Check-in Flow */
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: isMobile ? '76dvh' : 'auto',
          gap: '1.25rem',
          padding: '0.5rem 0'
        }}>
          {/* Header Info */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
              {isCheckOutMode ? t('Xác nhận khuôn mặt để chấm công ra về') : t('Tự động quét & nhận diện khuôn mặt')}
            </span>
            <div style={{
              backgroundColor: 'var(--color-bg)',
              color: 'var(--color-text)',
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '0.75rem',
              fontWeight: 700,
              border: '1px solid var(--color-border)'
            }}>
              {t('Quy định:')} <span style={{ color: '#BD1D2D' }}>
                {isCheckOutMode 
                  ? (consultantProfile?.work_end_time || '17:30') 
                  : (consultantProfile?.work_start_time || '08:00')}
              </span>
            </div>
          </div>

          {/* Middle Biometric Scanner Area (Centered Vertically on Mobile) */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
            margin: '1.5rem 0',
            position: 'relative'
          }}>
            {/* AI Scanner Circular Feed */}
            <div style={{ position: 'relative', width: '280px', height: '280px' }}>
              {/* Biometric Scanning Target Brackets & Radar Rings */}
              {(() => {
                const isHighProgress = faceScanProgress > 60;
                const targetColor = isHighProgress ? '#10b981' : '#3b82f6';
                return (
                  <>
                    {/* Outer Pulsing Radar Rings */}
                    <div className={`checkin-radar-ring ${isHighProgress ? 'active' : ''}`} />
                    <div className={`checkin-radar-ring-2 ${isHighProgress ? 'active' : ''}`} />

                    {/* Corner Targets */}
                    <div style={{ position: 'absolute', top: -14, left: -14, width: 22, height: 22, borderLeft: `3px solid ${targetColor}`, borderTop: `3px solid ${targetColor}`, borderTopLeftRadius: '8px', transition: 'border-color 0.25s ease', zIndex: 6 }} />
                    <div style={{ position: 'absolute', top: -14, right: -14, width: 22, height: 22, borderRight: `3px solid ${targetColor}`, borderTop: `3px solid ${targetColor}`, borderTopRightRadius: '8px', transition: 'border-color 0.25s ease', zIndex: 6 }} />
                    <div style={{ position: 'absolute', bottom: -14, left: -14, width: 22, height: 22, borderLeft: `3px solid ${targetColor}`, borderBottom: `3px solid ${targetColor}`, borderBottomLeftRadius: '8px', transition: 'border-color 0.25s ease', zIndex: 6 }} />
                    <div style={{ position: 'absolute', bottom: -14, right: -14, width: 22, height: 22, borderRight: `3px solid ${targetColor}`, borderBottom: `3px solid ${targetColor}`, borderBottomRightRadius: '8px', transition: 'border-color 0.25s ease', zIndex: 6 }} />
                  </>
                );
              })()}

              {/* Animated SVG Progress Ring */}
              <svg style={{ position: 'absolute', top: -10, left: -10, width: 300, height: 300, transform: 'rotate(-90deg)', zIndex: 12, pointerEvents: 'none' }}>
                <circle
                  cx="150"
                  cy="150"
                  r="135"
                  stroke="var(--color-border-light)"
                  strokeWidth="4"
                  fill="transparent"
                />
                <circle
                  cx="150"
                  cy="150"
                  r="135"
                  stroke={faceScanProgress >= 100 ? '#10b981' : '#3b82f6'}
                  strokeWidth="5"
                  fill="transparent"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 0.25s ease, stroke 0.3s ease' }}
                />
              </svg>

              {/* Video Container */}
              <div style={{
                position: 'relative',
                width: '280px',
                height: '280px',
                backgroundColor: '#0a0a0a',
                borderRadius: '50%',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: faceScanProgress > 60 ? '3px solid #10b981' : '3px solid rgba(255, 255, 255, 0.15)',
                boxShadow: faceScanProgress > 60 ? '0 0 35px rgba(16, 185, 129, 0.25)' : '0 12px 32px rgba(0,0,0,0.25)',
                transition: 'all 0.3s ease',
                zIndex: 10
              }}>
                {capturedImage ? (
                  <img
                    src={capturedImage}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    alt="Selfie"
                  />
                ) : isCameraActive ? (
                  <>
                    <video
                      ref={videoRef}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
                      autoPlay
                      playsInline
                      muted
                    />
                    {!isManualMode && (
                      <>
                        {/* Biometric Holographic Tech HUD Overlay */}
                        <div className={`checkin-scanner-hud ${faceScanProgress > 60 ? 'active' : ''}`} />

                        {/* Vertical Laser Scan Line Animation */}
                        <div className="checkin-scan-laser" />

                        {/* Translucent Face Oval Target Guide */}
                        <div style={{
                          position: 'absolute',
                          width: '160px',
                          height: '210px',
                          borderRadius: '50%',
                          border: faceScanProgress > 60 ? '2px dashed #10b981' : '2px dashed rgba(255,255,255,0.4)',
                          boxShadow: faceScanProgress > 60 ? '0 0 20px rgba(16, 185, 129, 0.3)' : 'none',
                          pointerEvents: 'none',
                          transition: 'all 0.3s ease'
                        }} />
                      </>
                    )}
                  </>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: '#fff', padding: '20px', textAlign: 'center' }}>
                    <Camera size={44} style={{ opacity: 0.5 }} />
                    <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                      {cameraError || t('Đang tải camera...')}
                    </span>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                      <button
                        type="button"
                        className="btn primary sm"
                        onClick={startCamera}
                        style={{ backgroundColor: '#BD1D2D', border: 'none', borderRadius: '20px' }}
                      >
                        {t('Kích hoạt Camera')}
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Floating Status Pill - Positioned below the Circular Camera Frame */}
            {isCameraActive && !capturedImage && (
              <div style={{
                marginTop: '16px',
                backgroundColor: faceScanProgress > 60 ? 'rgba(16, 185, 129, 0.95)' : 'rgba(15, 23, 42, 0.9)',
                backdropFilter: 'blur(8px)',
                color: '#fff',
                padding: '6px 18px',
                borderRadius: '20px',
                fontSize: '0.78rem',
                fontWeight: 700,
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                border: faceScanProgress > 60 ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(255, 255, 255, 0.15)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                zIndex: 15
              }}>
                <Sparkles size={13} className={faceScanProgress > 60 ? 'spin' : ''} />
                <span>
                  {faceScanProgress > 0 && faceScanProgress < 100
                    ? `${scanStatusText} (${faceScanProgress}%)`
                    : scanStatusText}
                </span>
              </div>
            )}

            {/* Captured Actions or Manual Retake */}
            {capturedImage && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginTop: '1.75rem', marginBottom: '0.5rem', width: '100%' }}>
                <button
                  type="button"
                  className="btn primary"
                  disabled={submitting}
                  onClick={() => submitCheckIn()}
                  style={{
                    backgroundColor: '#BD1D2D',
                    color: '#fff',
                    borderRadius: '24px',
                    padding: '12px 36px',
                    fontWeight: 700,
                    fontSize: '0.95rem',
                    boxShadow: '0 4px 15px rgba(189, 29, 45, 0.4)',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    width: '100%',
                    maxWidth: '340px',
                    cursor: submitting ? 'not-allowed' : 'pointer'
                  }}
                >
                  {submitting ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <RefreshCw size={16} className="spin" /> {t('Đang gửi...')}
                    </span>
                  ) : (
                    isCheckOutMode ? t('Xác nhận Ra ca') : t('Xác nhận Chấm công')
                  )}
                </button>

                <span
                  onClick={submitting ? undefined : startCamera}
                  style={{
                    fontSize: '0.85rem',
                    color: 'var(--color-text-light)',
                    textDecoration: 'underline',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    opacity: submitting ? 0.5 : 0.8,
                    marginTop: '4px'
                  }}
                >
                  <RefreshCw size={12} />
                  {t('Quét lại')}
                </span>
              </div>
            )}
          </div>

          {/* GPS Location Status Block */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            background: 'var(--color-bg-alt)',
            padding: '12px 14px',
            borderRadius: '12px',
            border: '1px solid var(--color-border-light)',
            width: '100%',
            boxSizing: 'border-box',
            marginBottom: '0.5rem'
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              width: 22, 
              height: 22, 
              borderRadius: '50%', 
              background: locationError ? 'rgba(239, 68, 68, 0.15)' : gpsCoords ? 'rgba(16, 185, 129, 0.15)' : 'rgba(189, 29, 45, 0.1)', 
              flexShrink: 0, 
              marginTop: '2px' 
            }}>
              <MapPin size={14} color={locationError ? '#ef4444' : gpsCoords ? '#10b981' : '#BD1D2D'} />
            </div>
            <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: locationError ? '#ef4444' : gpsCoords ? '#10b981' : 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                {locationError ? t('LỖI ĐỊNH VỊ (GPS BẮT BUỘC)') : gpsCoords ? t('ĐÃ XÁC THỰC GPS CHÍNH XÁC') : t('VỊ TRÍ CHẤM CÔNG')}
                {addressLoading && <RefreshCw size={10} className="spin" style={{ marginLeft: '4px', color: 'var(--color-text-muted)' }} />}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text)', marginTop: '4px', wordBreak: 'break-word', opacity: 0.9, lineHeight: 1.4 }}>
                {locationError || currentAddress || (gpsCoords ? `${gpsCoords.latitude.toFixed(6)}, ${gpsCoords.longitude.toFixed(6)}` : addressLoading ? t('Đang định vị GPS...') : t('Chưa có vị trí'))}
              </div>
            </div>
          </div>

          {/* Bottom Area: Late Reason & Control Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* Late Reason Input */}
            {isLate && capturedImage && (
              <div style={{
                background: 'linear-gradient(135deg, rgba(189, 29, 45, 0.03) 0%, rgba(189, 29, 45, 0.08) 100%)',
                border: '1px solid rgba(189, 29, 45, 0.18)',
                borderRadius: '16px',
                padding: '16px',
                boxShadow: '0 8px 30px rgba(189, 29, 45, 0.04)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                transition: 'all 0.3s ease'
              }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: '#991b1b', fontSize: '0.875rem', fontWeight: 800 }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(189, 29, 45, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <AlertTriangle size={15} />
                  </div>
                  {t('Bạn đã trễ') + ` ${minutesLate} ` + t('phút!')}
                </div>
                <p style={{ fontSize: '0.78rem', color: '#4b5563', margin: 0, lineHeight: 1.4 }}>
                  {t('Ghi chú lý do đi trễ (tùy chọn):')}
                </p>
                <textarea
                  className="form-control"
                  style={{
                    width: '100%',
                    height: '60px',
                    fontSize: '0.8125rem',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    border: '1px solid var(--color-border)',
                    background: '#ffffff',
                    color: '#1e293b',
                    resize: 'none',
                    outline: 'none',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)',
                    transition: 'all 0.25s ease'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#BD1D2D';
                    e.target.style.boxShadow = '0 0 0 3px rgba(189, 29, 45, 0.12)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'var(--color-border)';
                    e.target.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.02)';
                  }}
                  placeholder={t('Ghi chú (tùy chọn)...')}
                  value={checkInReason}
                  onChange={(e) => setCheckInReason(e.target.value)}
                />
              </div>
            )}

            {/* Manual Capture Option (Shown only during active scanning) */}
            {isCameraActive && !capturedImage && (
              <div style={{ textAlign: 'center', marginTop: '1rem', paddingBottom: '0.5rem' }}>
                <button
                  type="button"
                  onClick={handleManualCapture}
                  style={{
                    background: isManualMode ? '#BD1D2D' : 'transparent',
                    border: 'none',
                    color: isManualMode ? '#ffffff' : '#94a3b8',
                    fontSize: '0.8125rem',
                    fontWeight: isManualMode ? 700 : 500,
                    cursor: 'pointer',
                    padding: isManualMode ? '10px 28px' : '4px 12px',
                    borderRadius: isManualMode ? '24px' : '0',
                    textDecoration: isManualMode ? 'none' : 'underline',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    margin: '0 auto',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {isManualMode && <Camera size={16} />}
                  <span>{isManualMode ? t('Chụp ảnh thủ công') : t('Không nhận diện được khuôn mặt')}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </CustomModal>
  );
};
