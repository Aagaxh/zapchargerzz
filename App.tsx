import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Zap, 
  MapPin, 
  Clock, 
  Battery, 
  Search, 
  Navigation, 
  Calendar, 
  X, 
  CheckCircle2,
  AlertCircle,
  ChevronRight
} from 'lucide-react';

interface User {
  id: number;
  email: string;
  name: string;
}

interface Booking {
  id: number;
  station_name: string;
  location: string;
  time_label: string;
  booking_date: string;
  created_at: string;
}

interface Station {
  id: number;
  name: string;
  location: string;
  distance: string;
  status: string;
  fast_charging: number;
  total_slots: number;
  available_slots: number;
  price_per_kwh: string;
}

interface TimeSlot {
  id: number;
  station_id: number;
  time_label: string;
  is_booked: number;
}

export default function App() {
  const [view, setView] = useState<'home' | 'stations' | 'bookings' | 'login'>('home');
  const [user, setUser] = useState<User | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [bookingStatus, setBookingStatus] = useState<'idle' | 'booking' | 'success' | 'error'>('idle');
  const [searchQuery, setSearchQuery] = useState('');
  const [bookings, setBookings] = useState<Booking[]>([]);
  
  // Login form state
  const [loginEmail, setLoginEmail] = useState('user@example.com');
  const [loginPassword, setLoginPassword] = useState('password123');
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    fetchStations();
    // Check local storage for user
    const savedUser = localStorage.getItem('zapcharger_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  useEffect(() => {
    if (user && view === 'bookings') {
      fetchBookings();
    }
  }, [view, user]);

  useEffect(() => {
    if (isModalOpen && selectedStation) {
      fetchSlots(selectedStation.id, selectedDate);
    }
  }, [selectedDate, isModalOpen, selectedStation]);

  const fetchStations = async (date?: string) => {
    try {
      const targetDate = date || selectedDate;
      const res = await fetch(`/api/stations?date=${targetDate}`);
      const data = await res.json();
      setStations(data);
    } catch (err) {
      console.error('Failed to fetch stations', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSlots = async (stationId: number, date: string) => {
    try {
      const res = await fetch(`/api/stations/${stationId}/slots?date=${date}`);
      const data = await res.json();
      setSlots(data);
    } catch (err) {
      console.error('Failed to fetch slots', err);
    }
  };

  const fetchBookings = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/my-bookings/${user.id}`);
      const data = await res.json();
      setBookings(data);
    } catch (err) {
      console.error('Failed to fetch bookings', err);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });
      const data = await res.json();
      if (data.success) {
        setUser(data.user);
        localStorage.setItem('zapcharger_user', JSON.stringify(data.user));
        setView('home');
      } else {
        setLoginError(data.message || 'Login failed');
      }
    } catch (err) {
      setLoginError('An error occurred');
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('zapcharger_user');
    setView('home');
  };

  const openBooking = async (station: Station) => {
    if (!user) {
      setView('login');
      return;
    }
    setSelectedStation(station);
    setIsModalOpen(true);
    setBookingStatus('idle');
    setSelectedSlot(null);
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  const handleBook = async () => {
    if (!selectedStation || !selectedSlot || !user) return;
    setBookingStatus('booking');
    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stationId: selectedStation.id,
          slotId: selectedSlot,
          userId: user.id,
          bookingDate: selectedDate
        })
      });
      const data = await res.json();
      if (data.success) {
        setBookingStatus('success');
        fetchStations(); // Refresh availability
      } else {
        setBookingStatus('error');
      }
    } catch (err) {
      setBookingStatus('error');
    }
  };

  const filteredStations = stations.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0f111a] text-white font-sans selection:bg-indigo-500/30">
      {/* Background Glows */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-600/10 blur-[120px] rounded-full" />
      </div>

      {/* Navbar */}
      <nav className="sticky top-0 z-40 backdrop-blur-md border-b border-white/5 bg-[#0f111a]/80">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setView('home')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-transform">
              <Zap className="w-6 h-6 text-white fill-white" />
            </div>
            <span className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
              Zapcharger
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-white/60">
            <button onClick={() => setView('stations')} className={`hover:text-white transition-colors ${view === 'stations' ? 'text-white' : ''}`}>Find Stations</button>
            {user && <button onClick={() => setView('bookings')} className={`hover:text-white transition-colors ${view === 'bookings' ? 'text-white' : ''}`}>My Bookings</button>}
            <a href="#" className="hover:text-white transition-colors">Support</a>
            {user ? (
              <div className="flex items-center gap-4">
                <span className="text-white/40">Hi, {user.name}</span>
                <button onClick={handleLogout} className="px-5 py-2.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
                  Logout
                </button>
              </div>
            ) : (
              <button onClick={() => setView('login')} className="px-5 py-2.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
                Sign In
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {view === 'home' && (
          <section className="mb-16 text-center max-w-3xl mx-auto py-20">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-5xl md:text-8xl font-bold mb-6 tracking-tight leading-[1.1]"
            >
              The Future of <br />
              <span className="text-indigo-400">EV Charging.</span>
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-xl text-white/50 mb-10"
            >
              Locate, reserve, and charge. The most seamless way to power your electric journey in India.
            </motion.p>
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex flex-wrap justify-center gap-4"
            >
              <button onClick={() => setView('stations')} className="px-8 py-4 bg-indigo-500 hover:bg-indigo-400 rounded-2xl font-bold transition-all shadow-xl shadow-indigo-500/20">
                Find Stations
              </button>
              {!user && (
                <button onClick={() => setView('login')} className="px-8 py-4 bg-white/5 border border-white/10 hover:bg-white/10 rounded-2xl font-bold transition-all">
                  Get Started
                </button>
              )}
            </motion.div>
          </section>
        )}

        {view === 'login' && (
          <section className="max-w-md mx-auto py-20">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white/5 border border-white/10 rounded-[32px] p-10 backdrop-blur-xl"
            >
              <h2 className="text-3xl font-bold mb-2">Welcome Back</h2>
              <p className="text-white/40 mb-8">Sign in to manage your EV charging sessions.</p>
              
              <form onSubmit={handleLogin} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-white/40 mb-2">Email Address</label>
                  <input 
                    type="email" 
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 outline-none focus:border-indigo-500/50 transition-all"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/40 mb-2">Password</label>
                  <input 
                    type="password" 
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 outline-none focus:border-indigo-500/50 transition-all"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                  />
                </div>
                {loginError && <p className="text-rose-400 text-sm">{loginError}</p>}
                <button type="submit" className="w-full py-4 bg-indigo-500 hover:bg-indigo-400 rounded-2xl font-bold transition-all shadow-xl shadow-indigo-500/20">
                  Sign In
                </button>
              </form>
              <p className="mt-8 text-center text-sm text-white/40">
                Don't have an account? <a href="#" className="text-indigo-400 font-medium">Create one</a>
              </p>
            </motion.div>
          </section>
        )}

        {view === 'stations' && (
          <>
            <section className="mb-16 text-center max-w-3xl mx-auto">
              <h1 className="text-5xl font-bold mb-6 tracking-tight">Find a Station</h1>
              <div className="relative group max-w-2xl mx-auto">
                <div className="absolute inset-0 bg-indigo-500/20 blur-2xl rounded-full opacity-0 group-focus-within:opacity-100 transition-opacity" />
                <div className="relative flex items-center bg-white/5 border border-white/10 rounded-2xl p-2 backdrop-blur-xl focus-within:border-indigo-500/50 transition-all">
                  <Search className="w-5 h-5 ml-4 text-white/40" />
                  <input 
                    type="text" 
                    placeholder="Search by city, station name or address..."
                    className="flex-1 bg-transparent border-none outline-none px-4 py-3 text-white placeholder:text-white/20"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-semibold">Nearby Stations</h2>
                <div className="flex gap-2">
                  <button className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm hover:bg-white/10 transition-colors">All</button>
                  <button className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm hover:bg-white/10 transition-colors">Fast Charging</button>
                </div>
              </div>

              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-64 rounded-3xl bg-white/5 animate-pulse border border-white/5" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredStations.map((station, idx) => (
                    <motion.div
                      key={station.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="group relative bg-white/5 border border-white/10 rounded-3xl p-6 hover:bg-white/[0.08] hover:border-white/20 transition-all cursor-pointer"
                      onClick={() => openBooking(station)}
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-xl font-bold mb-1 group-hover:text-indigo-400 transition-colors">{station.name}</h3>
                          <div className="flex items-center gap-1 text-white/40 text-sm">
                            <MapPin className="w-3.5 h-3.5" />
                            {station.location}
                          </div>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          station.status === 'Available' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                          station.status === 'High Wait' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 
                          'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                          {station.status}
                        </div>
                      </div>

                      <div className="space-y-3 mb-8">
                        <div className="flex justify-between text-sm">
                          <span className="text-white/40 flex items-center gap-2"><Clock className="w-4 h-4" /> Wait Time</span>
                          <span className={station.status === 'Available' ? 'text-emerald-400' : 'text-amber-400'}>
                            {station.status === 'Available' ? 'No Wait' : '15-20 mins'}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-white/40 flex items-center gap-2"><Battery className="w-4 h-4" /> Power</span>
                          <span>{station.fast_charging ? '150kW DC Fast' : '22kW Level 2'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-white/40 flex items-center gap-2"><Zap className="w-4 h-4" /> Rate</span>
                          <span>{station.price_per_kwh}/kWh</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-white/5">
                        <div className="text-xs text-white/40">
                          <span className="text-white font-medium">{station.available_slots}</span> slots available
                        </div>
                        <button className="flex items-center gap-1 text-sm font-semibold text-indigo-400 group-hover:gap-2 transition-all">
                          Reserve Now <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {view === 'bookings' && (
          <section className="max-w-4xl mx-auto">
            <h1 className="text-4xl font-bold mb-10">My Bookings</h1>
            {bookings.length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-3xl p-20 text-center">
                <Calendar className="w-16 h-16 text-white/10 mx-auto mb-6" />
                <h3 className="text-xl font-bold mb-2">No bookings yet</h3>
                <p className="text-white/40 mb-8">You haven't reserved any charging slots yet.</p>
                <button onClick={() => setView('stations')} className="px-8 py-4 bg-indigo-500 hover:bg-indigo-400 rounded-2xl font-bold transition-all">
                  Find a Station
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {bookings.map((booking) => (
                  <motion.div 
                    key={booking.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-wrap items-center justify-between gap-6"
                  >
                    <div className="flex items-center gap-6">
                      <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 flex items-center justify-center">
                        <Zap className="w-7 h-7 text-indigo-400" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold">{booking.station_name}</h3>
                        <p className="text-white/40 text-sm flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" /> {booking.location}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-10">
                      <div className="text-right">
                        <p className="text-xs text-white/40 uppercase tracking-widest mb-1">Date & Time (IST)</p>
                        <p className="text-lg font-bold text-indigo-400">
                          {new Date(booking.booking_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} | {booking.time_label}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-white/40 uppercase tracking-widest mb-1">Status</p>
                        <p className="text-lg font-bold text-emerald-400 flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5" /> Confirmed
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {/* Booking Modal */}
      <AnimatePresence>
        {isModalOpen && selectedStation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setIsModalOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-[#151722] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl"
            >
              <div className="p-8">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-2xl font-bold mb-1">{selectedStation.name}</h2>
                    <p className="text-white/40 text-sm flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" /> {selectedStation.location}
                    </p>
                  </div>
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {bookingStatus === 'success' ? (
                  <div className="py-12 text-center">
                    <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                      <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                    </div>
                    <h3 className="text-2xl font-bold mb-2">Reservation Confirmed!</h3>
                    <p className="text-white/40 mb-8">Your slot for {new Date(selectedDate).toLocaleDateString('en-IN')} has been secured.</p>
                    <button 
                      onClick={() => setIsModalOpen(false)}
                      className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl font-bold hover:bg-white/10 transition-all"
                    >
                      Done
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="mb-6">
                      <h4 className="text-sm font-bold uppercase tracking-widest text-white/30 mb-3 flex items-center gap-2">
                        <Calendar className="w-4 h-4" /> Select Date
                      </h4>
                      <input 
                        type="date" 
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 outline-none focus:border-indigo-500/50 transition-all text-white"
                        value={selectedDate}
                        min={new Date().toISOString().split('T')[0]}
                        onChange={(e) => setSelectedDate(e.target.value)}
                      />
                    </div>

                    <div className="mb-8">
                      <h4 className="text-sm font-bold uppercase tracking-widest text-white/30 mb-4 flex items-center gap-2">
                        <Clock className="w-4 h-4" /> Select 24h Time Slot (IST)
                      </h4>
                      <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                        {slots.map(slot => (
                          <button
                            key={slot.id}
                            disabled={slot.is_booked === 1}
                            onClick={() => setSelectedSlot(slot.id)}
                            className={`py-2 rounded-xl text-xs font-medium transition-all border ${
                              slot.is_booked === 1 ? 'bg-white/5 border-transparent text-white/10 cursor-not-allowed' :
                              selectedSlot === slot.id ? 'bg-indigo-500 border-indigo-400 text-white shadow-lg shadow-indigo-500/20' :
                              'bg-white/5 border-white/5 hover:border-white/20 text-white/60 hover:text-white'
                            }`}
                          >
                            {slot.time_label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {bookingStatus === 'error' && (
                      <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 text-rose-400 text-sm">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        Something went wrong. Please try another slot.
                      </div>
                    )}

                    <button 
                      disabled={!selectedSlot || bookingStatus === 'booking'}
                      onClick={handleBook}
                      className="w-full py-4 bg-indigo-500 hover:bg-indigo-400 disabled:bg-white/5 disabled:text-white/20 disabled:cursor-not-allowed rounded-2xl font-bold transition-all shadow-xl shadow-indigo-500/20 flex items-center justify-center gap-2"
                    >
                      {bookingStatus === 'booking' ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        `Confirm Reservation (${selectedStation.price_per_kwh}/kWh)`
                      )}
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
