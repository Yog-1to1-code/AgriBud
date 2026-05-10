"use client";
import React, { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { Plus, Leaf, Loader2, MapPin, Calendar, X, Navigation, Settings as SettingsIcon, Trash2, Sprout, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';

export default function DashboardPage() {
  const { t } = useLanguage();
  const [crops, setCrops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form State
  const [newCropName, setNewCropName] = useState('');
  const [dateOfSowing, setDateOfSowing] = useState('');
  const [location, setLocation] = useState('');
  const [isLocating, setIsLocating] = useState(false);

  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    fetchCrops();
  }, []);

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

  const handleAddCrop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCropName.trim()) return;
    
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

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
          location: location.trim() || null
        })
        .select()
        .single();
      
      if (error) throw error;

      if (data) {
        setCrops([data, ...crops]);
        setNewCropName('');
        setDateOfSowing('');
        setLocation('');
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

  return (
    <div className="app-shell" style={{ backgroundColor: 'var(--bg-deep)' }}>
      {/* Professional Navbar */}
      <header style={{ 
        padding: '0.75rem 2rem', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        backgroundColor: 'var(--bg-surface)',
        borderBottom: '1.5px solid var(--border)',
        zIndex: 50 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ padding: '0.4rem', backgroundColor: 'var(--primary)', borderRadius: 'var(--radius-sm)' }}>
            <Sprout size={20} color="white" />
          </div>
          <h1 style={{ fontSize: '1.4rem', color: 'var(--primary)', letterSpacing: '-0.02em' }}>{t('appName')} Dashboard</h1>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <Link href="/settings" style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 500, fontSize: '0.9rem' }}>
            <SettingsIcon size={18} />
            <span>{t('settings')}</span>
          </Link>
        </div>
      </header>

      <main className="content-scroll" style={{ maxWidth: '1400px', margin: '0 auto', width: '100%', padding: '2rem 1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h2 style={{ fontSize: '2.2rem', color: 'var(--primary)', marginBottom: '0.4rem' }}>{t('welcomeFarmer')}</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>{t('dashboardSub')}</p>
          </div>
          <button onClick={() => setIsModalOpen(true)} className="btn-primary" style={{ padding: '0.8rem 1.5rem', fontSize: '1rem', gap: '0.6rem' }}>
            <Plus size={20} /> {t('addCrop')}
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '5rem' }}>
            <Loader2 className="animate-spin" size={40} color="var(--primary-light)" />
          </div>
        ) : crops.length === 0 ? (
          <div style={{ 
            padding: '4rem 2rem', 
            textAlign: 'center', 
            borderRadius: 'var(--radius-xl)', 
            backgroundColor: 'var(--bg-surface)',
            border: '2px dashed var(--border)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
              <Sprout size={40} color="var(--primary-light)" />
            </div>
            <h3 style={{ fontSize: '1.6rem', color: 'var(--primary)', marginBottom: '0.75rem' }}>{t('noCrops')}</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', maxWidth: '350px', lineHeight: 1.5 }}>{t('noCropsSub')}</p>
            <button onClick={() => setIsModalOpen(true)} className="btn-primary">Add Your First Crop</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {crops.map((crop) => (
              <div key={crop.id} style={{ position: 'relative' }}>
                <Link href={`/dashboard/crop/${crop.id}`}>
                  <div className="glass animate-fade-in" style={{ 
                    padding: '1.5rem', 
                    borderRadius: 'var(--radius-lg)', 
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    cursor: 'pointer',
                    height: '100%',
                    border: '1.5px solid var(--border)',
                    backgroundColor: 'var(--bg-surface)'
                  }} 
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = 'var(--primary-light)';
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
                  }} 
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                      <div style={{ padding: '0.6rem', backgroundColor: 'var(--bg-hover)', borderRadius: 'var(--radius-md)' }}>
                        <Sprout size={24} color="var(--primary-light)" />
                      </div>
                      <button 
                        onClick={(e) => handleDeleteCrop(crop.id, e)}
                        style={{ padding: '0.5rem', borderRadius: '50%', color: '#e5e7eb' }}
                        onMouseOver={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.backgroundColor = '#fee2e2'; }}
                        onMouseOut={(e) => { e.currentTarget.style.color = '#e5e7eb'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>

                    <h3 style={{ fontSize: '1.4rem', color: 'var(--primary)', marginBottom: '1rem' }}>{crop.name}</h3>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', color: 'var(--text-muted)', fontSize: '0.9rem', borderTop: '1px solid #f3f4f6', paddingTop: '1rem' }}>
                      {crop.date_of_sowing && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <Calendar size={16} color="var(--primary-light)" />
                          <span>{t('sowingDate')}: <strong>{new Date(crop.date_of_sowing).toLocaleDateString()}</strong></span>
                        </div>
                      )}
                      {crop.location && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <MapPin size={16} color="var(--primary-light)" />
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{crop.location}</span>
                        </div>
                      )}
                    </div>

                    <div style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--primary-light)', fontWeight: 600, fontSize: '0.85rem' }}>
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
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(6, 78, 59, 0.4)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="animate-fade-in" style={{ width: '100%', maxWidth: '500px', backgroundColor: 'var(--bg-surface)', padding: '2rem', borderRadius: 'var(--radius-xl)', position: 'relative', boxShadow: '0 30px 60px -12px rgba(6, 78, 59, 0.25)' }}>
            <button onClick={() => setIsModalOpen(false)} style={{ position: 'absolute', top: '1rem', right: '1.25rem', color: 'var(--text-muted)', padding: '0.4rem', borderRadius: '50%' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
              <X size={20} />
            </button>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <div style={{ width: '50px', height: '50px', backgroundColor: 'var(--bg-hover)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto' }}>
                <Sprout size={24} color="var(--primary-light)" />
              </div>
              <h2 style={{ fontSize: '1.8rem', color: 'var(--primary)', marginBottom: '0.25rem' }}>{t('addCrop')}</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Professional monitoring for your harvest.</p>
            </div>
            
            <form onSubmit={handleAddCrop} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: 'var(--primary)', marginBottom: '0.5rem' }}>{t('cropType')}</label>
                <input type="text" className="input-field" placeholder="e.g. Basmati Rice, Wheat" value={newCropName} onChange={(e) => setNewCropName(e.target.value)} required style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: 'var(--primary)', marginBottom: '0.5rem' }}>{t('sowingDate')}</label>
                <input type="date" className="input-field" value={dateOfSowing} onChange={(e) => setDateOfSowing(e.target.value)} style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: 'var(--primary)', marginBottom: '0.5rem' }}>{t('location')}</label>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <input type="text" className="input-field" placeholder="Identify your field" value={location} onChange={(e) => setLocation(e.target.value)} style={{ flex: 1 }} />
                  <button type="button" onClick={handleFetchGPS} style={{ padding: '0.6rem', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--border)', color: 'var(--primary-light)' }} disabled={isLocating}>
                    {isLocating ? <Loader2 className="animate-spin" size={20} /> : <Navigation size={20} />}
                  </button>
                </div>
              </div>
              <button type="submit" className="btn-primary" style={{ marginTop: '0.5rem', width: '100%', padding: '1rem' }} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : t('saveCrop')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
