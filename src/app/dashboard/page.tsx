"use client";
import React, { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { Plus, Loader2, MapPin, Calendar, X, Navigation, Settings as SettingsIcon, Trash2, Sprout, ChevronRight, Satellite, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDemo } from '@/contexts/DemoContext';

export default function DashboardPage() {
  const { t } = useLanguage();
  const { isDemoMode, demoCrops, addDemoCrop, deleteDemoCrop, disableDemoMode } = useDemo();
  const [crops, setCrops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form State
  const [newCropName, setNewCropName] = useState('');
  const [dateOfSowing, setDateOfSowing] = useState('');
  const [location, setLocation] = useState('');
  const [coords, setCoords] = useState<{lat: number, lng: number} | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isLocatingCubesat, setIsLocatingCubesat] = useState(false);
  const [villageSensorData, setVillageSensorData] = useState<any>(null);
  const [cubesatIp, setCubesatIp] = useState<string>('');
  const [toast, setToast] = useState<{message: string, type: 'error' | 'success'} | null>(null);

  const showToast = (message: string, type: 'error' | 'success') => {
    setToast({message, type});
    setTimeout(() => setToast(null), 3000);
  };

  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    if (isDemoMode) {
      setCrops(demoCrops);
      setLoading(false);
    } else {
      fetchCrops();
    }
  }, [isDemoMode, demoCrops]);

  useEffect(() => {
    if (isDemoMode) return; // Skip polling in demo
    const interval = setInterval(async () => {
      if (crops.length === 0) return;
      const updatedCrops = [...crops];
      let hasUpdates = false;

      for (let i = 0; i < updatedCrops.length; i++) {
        const crop = updatedCrops[i];
        if (crop.cubesat_ip) {
          try {
            const res = await fetch(`http://${crop.cubesat_ip}/data`);
            if (res.ok) {
              const data = await res.json();
              const villageData = {
                rt: data.rt, rh: data.rh, rs: data.rs, rw: data.rw, rv: data.rv
              };
              
              await supabase
                .from('farmer_crops')
                .update({ village_sensor_data: villageData })
                .eq('id', crop.id);
                
              updatedCrops[i].village_sensor_data = villageData;
              hasUpdates = true;
            }
          } catch (e) {
            console.error("Failed background fetch for CubeSat IP:", crop.cubesat_ip);
          }
        }
      }
      if (hasUpdates) setCrops(updatedCrops);
    }, 600000);

    return () => clearInterval(interval);
  }, [crops, isDemoMode]);

  const fetchCrops = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data, error } = await supabase
        .from('farmer_crops')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      if (data) setCrops(data);
    } catch (err) {
      console.error("Error fetching crops:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFetchGPS = () => {
    setIsLocating(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          setCoords({ lat: latitude, lng: longitude });
          try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
            const data = await response.json();
            setLocation(data.display_name || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
          } catch (err) {
            setLocation(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
          }
          setIsLocating(false);
        },
        () => {
          alert("Could not fetch location.");
          setIsLocating(false);
        }
      );
    }
  };

  const handleFetchCubesat = async () => {
    const ip = prompt("Enter CubeSat IP address (e.g. 192.168.4.1):", "192.168.4.1");
    if (!ip) return;
    setCubesatIp(ip);
    setIsLocatingCubesat(true);
    try {
      const res = await fetch(`http://${ip}/data`);
      if (!res.ok) throw new Error("Failed to connect");
      const data = await res.json();
      
      if (data.gps && data.gps !== "NO GPS") {
        const parts = data.gps.split(',');
        if (parts.length >= 2) {
          const lat = parseFloat(parts[0]);
          const lng = parseFloat(parts[1]);
          if (!isNaN(lat) && !isNaN(lng)) {
            setCoords({ lat, lng });
            setLocation(`CubeSat: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
          }
        } else {
           setLocation(data.gps);
        }
      }
      
      const villageData = {
        rt: data.rt, rh: data.rh, rs: data.rs, rw: data.rw, rv: data.rv
      };
      setVillageSensorData(villageData);
      showToast("Successfully synced with Village Node!", "success");
      
    } catch (err) {
      console.error(err);
      showToast("Unable to connect to CubeSat", "error");
    } finally {
      setIsLocatingCubesat(false);
    }
  };

  const handleAddCrop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCropName.trim()) return;
    
    if (isDemoMode) {
      addDemoCrop({
        name: newCropName.trim(),
        date_of_sowing: dateOfSowing || undefined,
        location: location.trim() || undefined,
      });
      setNewCropName('');
      setDateOfSowing('');
      setLocation('');
      setIsModalOpen(false);
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      let finalLat = coords?.lat || null;
      let finalLng = coords?.lng || null;

      if (!finalLat && location.trim()) {
        try {
          const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location.trim())}&limit=1`);
          const geoData = await geoRes.json();
          if (geoData && geoData.length > 0) {
            finalLat = parseFloat(geoData[0].lat);
            finalLng = parseFloat(geoData[0].lon);
          }
        } catch (geoErr) {
          console.error("Geocoding failed:", geoErr);
        }
      }

      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();
      
      if (!profile || profileErr) {
        await supabase.from('profiles').insert({ id: user.id });
      }

      const { data, error } = await supabase
        .from('farmer_crops')
        .insert({ 
          user_id: user.id, 
          name: newCropName.trim(),
          date_of_sowing: dateOfSowing || null,
          location: location.trim() || null,
          latitude: finalLat,
          longitude: finalLng,
          village_sensor_data: villageSensorData,
          cubesat_ip: cubesatIp || null
        })
        .select()
        .single();
      
      if (error) throw error;

      if (data) {
        setCrops([data, ...crops]);
        setNewCropName('');
        setDateOfSowing('');
        setLocation('');
        setCoords(null);
        setVillageSensorData(null);
        setCubesatIp('');
        setIsModalOpen(false);
      }
    } catch (err: any) {
      console.error("Error saving crop:", err);
      alert("Failed to save crop: " + (err.message || "Unknown error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCrop = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!confirm(t('deleteCropConfirm'))) return;

    if (isDemoMode) {
      deleteDemoCrop(id);
      return;
    }

    try {
      const { error } = await supabase
        .from('farmer_crops')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      setCrops(crops.filter(c => c.id !== id));
    } catch (err: any) {
      console.error("Error deleting crop:", err);
      alert("Failed to delete crop.");
    }
  };

  const handleLogout = async () => {
    if (isDemoMode) {
      disableDemoMode();
      router.push('/');
      return;
    }
    await supabase.auth.signOut();
    router.push('/');
  };

  return (
    <div className="app-shell" style={{ backgroundColor: 'var(--bg-deep)' }}>
      {/* Demo Mode Badge */}
      {isDemoMode && <div className="demo-badge">Demo Mode</div>}

      {/* Toast */}
      {toast && (
        <div className="animate-slide-up" style={{
          position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
          padding: '0.8rem 1.5rem', borderRadius: 'var(--radius-md)', zIndex: 9999, fontWeight: 500,
          backgroundColor: toast.type === 'error' ? '#ef4444' : '#22c55e', color: 'white',
          boxShadow: 'var(--shadow-lg)', maxWidth: '90vw', textAlign: 'center', fontSize: '0.9rem'
        }}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <header style={{ 
        padding: '0.6rem clamp(0.75rem, 3vw, 2rem)', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        backgroundColor: 'var(--bg-surface)',
        borderBottom: '1.5px solid var(--border)',
        zIndex: 50,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
          <div style={{ padding: '0.35rem', backgroundColor: 'var(--primary)', borderRadius: 'var(--radius-sm)', flexShrink: 0 }}>
            <Sprout size={18} color="white" />
          </div>
          <h1 style={{ 
            fontSize: 'clamp(1rem, 3vw, 1.3rem)', 
            color: 'var(--primary)', 
            letterSpacing: '-0.02em',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {t('appName')}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
          {!isDemoMode && (
            <Link href="/settings" style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 500, fontSize: '0.85rem', padding: '0.4rem' }}>
              <SettingsIcon size={18} />
              <span className="mobile-hidden">{t('settings')}</span>
            </Link>
          )}
          <button 
            onClick={handleLogout}
            style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 500, fontSize: '0.85rem', padding: '0.4rem' }}
          >
            <LogOut size={18} />
            <span className="mobile-hidden">{isDemoMode ? 'Exit Demo' : t('logout')}</span>
          </button>
        </div>
      </header>

      <main className="content-scroll" style={{ 
        maxWidth: '1400px', 
        margin: '0 auto', 
        width: '100%', 
        padding: 'clamp(0.75rem, 3vw, 2rem)',
      }}>
        {/* Welcome Section */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'flex-start', 
          marginBottom: '1.5rem', 
          gap: '1rem',
          flexWrap: 'wrap',
        }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ 
              fontSize: 'clamp(1.4rem, 4vw, 2rem)', 
              color: 'var(--primary)', 
              marginBottom: '0.3rem' 
            }}>
              {t('welcomeFarmer')}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 'clamp(0.8rem, 2vw, 0.95rem)' }}>{t('dashboardSub')}</p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)} 
            className="btn-primary" 
            style={{ padding: '0.7rem 1.25rem', fontSize: '0.9rem', gap: '0.5rem', flexShrink: 0 }}
          >
            <Plus size={18} /> {t('addCrop')}
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
            <Loader2 className="animate-spin" size={36} color="var(--primary-light)" />
          </div>
        ) : crops.length === 0 ? (
          <div style={{ 
            padding: 'clamp(2rem, 5vw, 4rem) 1.5rem', 
            textAlign: 'center', 
            borderRadius: 'var(--radius-xl)', 
            backgroundColor: 'var(--bg-surface)',
            border: '2px dashed var(--border)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}>
            <div style={{ width: '70px', height: '70px', borderRadius: '50%', backgroundColor: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
              <Sprout size={36} color="var(--primary-light)" />
            </div>
            <h3 style={{ fontSize: 'clamp(1.2rem, 3vw, 1.5rem)', color: 'var(--primary)', marginBottom: '0.6rem' }}>{t('noCrops')}</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', maxWidth: '320px', lineHeight: 1.5, fontSize: '0.9rem' }}>{t('noCropsSub')}</p>
            <button onClick={() => setIsModalOpen(true)} className="btn-primary" style={{ padding: '0.7rem 1.5rem' }}>Add Your First Crop</button>
          </div>
        ) : (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))', 
            gap: '1rem' 
          }}>
            {crops.map((crop) => (
              <div key={crop.id} style={{ position: 'relative' }}>
                <Link href={`/dashboard/crop/${crop.id}`}>
                  <div className="glass animate-fade-in" style={{ 
                    padding: '1.25rem', 
                    borderRadius: 'var(--radius-lg)', 
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    cursor: 'pointer',
                    height: '100%',
                    border: '1.5px solid var(--border)',
                    backgroundColor: 'var(--bg-surface)'
                  }} 
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = 'var(--primary-light)';
                    e.currentTarget.style.transform = 'translateY(-3px)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
                  }} 
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                      <div style={{ padding: '0.5rem', backgroundColor: 'var(--bg-hover)', borderRadius: 'var(--radius-md)' }}>
                        <Sprout size={22} color="var(--primary-light)" />
                      </div>
                      <button 
                        onClick={(e) => handleDeleteCrop(crop.id, e)}
                        style={{ padding: '0.4rem', borderRadius: '50%', color: '#d1d5db' }}
                        onMouseOver={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.backgroundColor = '#fee2e2'; }}
                        onMouseOut={(e) => { e.currentTarget.style.color = '#d1d5db'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <h3 style={{ fontSize: '1.2rem', color: 'var(--primary)', marginBottom: '0.75rem' }}>{crop.name}</h3>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem', borderTop: '1px solid #f3f4f6', paddingTop: '0.75rem' }}>
                      {crop.date_of_sowing && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Calendar size={14} color="var(--primary-light)" style={{ flexShrink: 0 }} />
                          <span>{t('sowingDate')}: <strong>{new Date(crop.date_of_sowing).toLocaleDateString()}</strong></span>
                        </div>
                      )}
                      {crop.location && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                          <MapPin size={14} color="var(--primary-light)" style={{ flexShrink: 0 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{crop.location}</span>
                        </div>
                      )}
                    </div>

                    <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--primary-light)', fontWeight: 600, fontSize: '0.8rem' }}>
                      {t('viewHistory')} <ChevronRight size={14} />
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Add Crop Modal */}
      {isModalOpen && (
        <div style={{ 
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          backgroundColor: 'rgba(6, 78, 59, 0.4)', backdropFilter: 'blur(8px)', 
          zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', 
          padding: 'clamp(0.75rem, 3vw, 1.5rem)',
        }}>
          <div className="animate-fade-in" style={{ 
            width: '100%', maxWidth: '460px', 
            backgroundColor: 'var(--bg-surface)', 
            padding: 'clamp(1.25rem, 4vw, 2rem)', 
            borderRadius: 'var(--radius-xl)', 
            position: 'relative', 
            boxShadow: '0 30px 60px -12px rgba(6, 78, 59, 0.25)',
            maxHeight: '90dvh',
            overflowY: 'auto',
          }}>
            <button onClick={() => setIsModalOpen(false)} style={{ position: 'absolute', top: '0.75rem', right: '1rem', color: 'var(--text-muted)', padding: '0.4rem', borderRadius: '50%', zIndex: 1 }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
              <X size={20} />
            </button>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ width: '44px', height: '44px', backgroundColor: 'var(--bg-hover)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem auto' }}>
                <Sprout size={22} color="var(--primary-light)" />
              </div>
              <h2 style={{ fontSize: 'clamp(1.3rem, 3vw, 1.6rem)', color: 'var(--primary)', marginBottom: '0.2rem' }}>{t('addCrop')}</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Professional monitoring for your harvest.</p>
            </div>
            
            <form onSubmit={handleAddCrop} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary)', marginBottom: '0.4rem' }}>{t('cropType')}</label>
                <input type="text" className="input-field" placeholder="e.g. Basmati Rice, Wheat" value={newCropName} onChange={(e) => setNewCropName(e.target.value)} required style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary)', marginBottom: '0.4rem' }}>{t('sowingDate')}</label>
                <input type="date" className="input-field" value={dateOfSowing} onChange={(e) => setDateOfSowing(e.target.value)} style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary)', marginBottom: '0.4rem' }}>{t('location')}</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input type="text" className="input-field" placeholder="Identify your field" value={location} onChange={(e) => setLocation(e.target.value)} style={{ flex: 1, minWidth: 0 }} />
                  {!isDemoMode && (
                    <>
                      <button type="button" onClick={handleFetchGPS} style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--border)', color: 'var(--primary-light)', flexShrink: 0 }} disabled={isLocating} title="Use Device GPS">
                        {isLocating ? <Loader2 className="animate-spin" size={18} /> : <Navigation size={18} />}
                      </button>
                      <button type="button" onClick={handleFetchCubesat} style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--border)', color: 'var(--primary-light)', backgroundColor: villageSensorData ? 'var(--bg-hover)' : 'transparent', flexShrink: 0 }} disabled={isLocatingCubesat} title="Sync with CubeSat Node">
                        {isLocatingCubesat ? <Loader2 className="animate-spin" size={18} /> : <Satellite size={18} />}
                      </button>
                    </>
                  )}
                </div>
              </div>
              <button type="submit" className="btn-primary" style={{ marginTop: '0.25rem', width: '100%', padding: '0.85rem', borderRadius: 'var(--radius-md)' }} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : t('saveCrop')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
