"use client";

import { useState, useEffect } from "react";
import {
  Bell,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Crosshair,
  Filter,
  Home as HomeIcon,
  Languages,
  MapPin,
  Menu,
  Mic,
  Navigation,
  Phone,
  Search,
  ShieldCheck,
  Sprout,
  Store,
  TrendingUp,
  Volume2,
  X,
  Building2,
  Send,
  User as UserIcon,
  LogIn,
  CheckCircle2,
  Download,
} from "lucide-react";

import { api } from "@/lib/api";
import { translations, Language } from "@/lib/translations";
import { BusinessRegistrationModal } from "@/components/BusinessRegistrationModal";
import { SendEnquiryModal } from "@/components/SendEnquiryModal";
import { VoiceAssistantModal } from "@/components/VoiceAssistantModal";
import { AuthModal } from "@/components/AuthModal";
import { MapView } from "@/components/MapView";

type Buyer = {
  id?: string;
  _id?: string;
  name: string;
  category: string;
  distance: string;
  distanceKm?: number;
  price: number;
  capacity?: string;
  updated?: string;
  verified: boolean;
  isVerified?: boolean;
  pickup: string;
  accent?: string;
  phone?: string;
  district?: string;
  state?: string;
  coordinates?: [number, number];
  isMarketReference?: boolean;
  source?: string;
  reportedDate?: string;
};

const defaultSeedBuyers: Buyer[] = [];

function money(value: number) {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

export default function Home() {
  const [active, setActive] = useState("Home");
  const [lang, setLang] = useState<Language>("kn"); // Default Karnataka first-class experience
  const t = translations[lang] || translations.en;

  const [location, setLocation] = useState("Detecting your location...");
  const [district, setDistrict] = useState<string | null>(null);
  const [crop, setCrop] = useState("Tomato");
  const [quantity, setQuantity] = useState(500);
  const [quote, setQuote] = useState(28);
  const [radius, setRadius] = useState(50);
  const [gpsMessage, setGpsMessage] = useState("");
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Authenticated User State
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Live Buyers State from Express 2dsphere API
  const [buyersList, setBuyersList] = useState<Buyer[]>(defaultSeedBuyers);
  const [loadingBuyers, setLoadingBuyers] = useState(false);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Mandi Benchmarks from Express API
  const [mandiBenchmark, setMandiBenchmark] = useState<number | null>(null);
  const [mandiSource, setMandiSource] = useState("Live market data unavailable");

  // Modals State
  const [isBusinessModalOpen, setIsBusinessModalOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [selectedBuyerForEnquiry, setSelectedBuyerForEnquiry] = useState<Buyer | null>(null);

  // Fetch initial profile & buyers on mount
  useEffect(() => {
    checkCurrentUser();
    fetchBenchmarkPrices("Tomato");
    fetchNearbyBuyers(null);
    requestGpsLocation();
  }, []);

  const checkCurrentUser = async () => {
    const res = await api.get("/auth/me");
    if (res.success && res.user) {
      setCurrentUser(res.user);
    }
  };

  const fetchBenchmarkPrices = async (selectedCrop = crop, selectedDistrict: string | null = district) => {
    const res = await api.get("/prices", {
      crop: selectedCrop,
      district: selectedDistrict || undefined,
      lat: userCoords?.lat,
      lng: userCoords?.lng,
    });
    if (res.success && res.prices && res.prices.length > 0) {
      setMandiBenchmark(res.prices[0].modalPricePerKg);
      setMandiSource(`${res.prices[0].source} · ${res.prices[0].market}${res.fallbackMessage ? ` · ${res.fallbackMessage}` : ""}`);
    } else {
      setMandiBenchmark(null);
      setMandiSource(res.message || "Live market data unavailable");
    }
  };

  const fetchNearbyBuyers = async (coords?: { lat: number; lng: number } | null, districtName?: string | null) => {
    setLoadingBuyers(true);
    const params: any = { crop, radiusKm: radius };

    if (coords) {
      params.lat = coords.lat;
      params.lng = coords.lng;
    } else {
      if (districtName) params.district = districtName;
    }

    const res = await api.get("/buyers/nearby", params);
    setLoadingBuyers(false);

    if (res.success && res.results && res.results.length > 0) {
      const mapped: Buyer[] = res.results.map((b: any) => ({
        id: b.id || b._id,
        name: b.name,
        category: b.category,
        distance: b.distanceLabel || "Nearby",
        distanceKm: b.distanceKm || 15,
        price: b.bestOfferPricePerKg ?? b.marketPricePerKg ?? 0,
        capacity: "Active requirement",
        updated: "Real-time listing",
        verified: b.isVerified || b.verificationStatus === "verified",
        pickup: b.transportPreference === "pickup" ? "Pickup available" : "Drop-off required",
        accent: b.isVerified ? "mint" : "gold",
        phone: b.phone,
        district: b.district,
        state: b.state,
        coordinates: Array.isArray(b.coordinates) && b.coordinates.length === 2 ? b.coordinates : undefined,
        isMarketReference: Boolean(b.isMarketReference),
        source: b.source,
        reportedDate: b.reportedDate,
      }));
      setBuyersList(mapped);
    } else {
      setBuyersList([]);
    }
  };

  const quoteDelta = mandiBenchmark === null ? null : quote - mandiBenchmark;
  const manualMapCenter: [number, number] = location.startsWith("Hubballi")
    ? [15.3647, 75.124]
    : location.startsWith("Belagavi")
    ? [15.8497, 74.4977]
    : location.startsWith("Kolar")
    ? [13.1367, 78.1292]
    : location.startsWith("Harihar")
    ? [14.512, 75.807]
    : location.startsWith("Chamarajanagar")
    ? [11.9261, 76.9437]
    : [14.4644, 75.9218];
  const mapCenter: [number, number] = userCoords
    ? [userCoords.lat, userCoords.lng]
    : manualMapCenter;

  async function requestGpsLocation() {
    if (!navigator.geolocation) {
      setLocation("Location unavailable");
      setGpsMessage("GPS is not available. Choose a district manually.");
      fetchBenchmarkPrices(crop, null);
      return;
    }
    setGpsMessage("Locating via GPS...");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserCoords(coords);
        const place = await reverseGeocode(coords);
        setDistrict(place?.district || null);
        setLocation(place ? `${place.district}, ${place.state}` : `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`);
        setGpsMessage(`Location detected${place ? ` near ${place.district}` : ""}. Nearby search is active.`);
        fetchBenchmarkPrices(crop, place?.district || null);
        fetchNearbyBuyers(coords);
      },
      () => {
        setGpsMessage("Location access was declined. Manual district selection remains active.");
        fetchBenchmarkPrices(crop, district);
        fetchNearbyBuyers(null, district);
      }
    );
  }

  const useGps = requestGpsLocation;

  async function reverseGeocode(coords: { lat: number; lng: number }) {
    const key = process.env.NEXT_PUBLIC_MAPTILER_API_KEY;
    if (!key) return null;
    try {
      const response = await fetch(`https://api.maptiler.com/geocoding/${coords.lng},${coords.lat}.json?key=${key}&language=en`);
      if (!response.ok) return null;
      const payload = await response.json();
      const feature = payload.features?.find((item: { place_type?: string[] }) => item.place_type?.includes("county") || item.place_type?.includes("region"));
      const context = feature?.context || [];
      const districtFeature = context.find((item: { id?: string }) => item.id?.startsWith("county"));
      const stateFeature = context.find((item: { id?: string }) => item.id?.startsWith("state"));
      return { district: districtFeature?.text || feature?.text || "Nearby district", state: stateFeature?.text || "India" };
    } catch {
      return null;
    }
  }

  const handleLocationChange = (newLoc: string) => {
    setLocation(newLoc);
    const dist = newLoc.split(",")[0].trim();
    setDistrict(dist);
    fetchBenchmarkPrices(crop, dist);
    fetchNearbyBuyers(null, dist);
  };

  const handleCropChange = (newCrop: string) => {
    setCrop(newCrop);
    fetchBenchmarkPrices(newCrop, district);
    fetchNearbyBuyers(userCoords, district);
  };

  const navItems = [
    { label: t.home, icon: HomeIcon, id: "Home" },
    { label: t.comparePrices, icon: TrendingUp, id: "Compare prices" },
    { label: t.findBuyers, icon: Store, id: "Find buyers" },
    { label: t.businessPortal, icon: Building2, id: "Register business" },
  ];

  return (
    <div className="app-shell">
      {/* Side Navigation */}
      <aside className={`sidebar ${showMobileMenu ? "sidebar-open" : ""}`}>
        <div className="brand-row">
          <div className="brand-mark">
            <Sprout size={22} strokeWidth={2.5} />
          </div>
          <div>
            <strong>{t.brandName}</strong>
            <span>ಕೃಷಿಸೇತು · KRISHISETU</span>
          </div>
          <button
            className="icon-btn close-mobile"
            onClick={() => setShowMobileMenu(false)}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>
        <div className="sidebar-kicker">{t.brandTagline.toUpperCase()}</div>
        <nav className="sidebar-nav" aria-label="Main navigation">
          {navItems.map(({ label, icon: Icon, id }) => (
            <button
              key={id}
              className={active === id ? "nav-item active" : "nav-item"}
              onClick={() => {
                if (id === "Register business") {
                  setIsBusinessModalOpen(true);
                } else {
                  setActive(id);
                }
                setShowMobileMenu(false);
              }}
            >
              <Icon size={19} /> <span>{label}</span>
              {active === id && <ChevronRight size={16} className="nav-arrow" />}
            </button>
          ))}
        </nav>

        <div
          className="sidebar-help"
          style={{ cursor: "pointer" }}
          onClick={() => setIsVoiceModalOpen(true)}
        >
          <Mic size={19} color="#d6eb65" />
          <div>
            <strong>{t.askKrishiSetu}</strong>
            <span>{t.askInLanguage}</span>
          </div>
          <ChevronRight size={16} />
        </div>

        <div
          className="sidebar-profile"
          style={{ cursor: "pointer" }}
          onClick={() => {
            if (!currentUser) setIsAuthModalOpen(true);
          }}
        >
          <div className="avatar">
            {currentUser ? currentUser.name.substring(0, 2).toUpperCase() : <LogIn size={15} />}
          </div>
          <div>
            <strong>{currentUser ? currentUser.name : t.login}</strong>
            <span>{currentUser ? `${currentUser.role} profile` : "Farmer / Buyer"}</span>
          </div>
          <ChevronDown size={16} />
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header className="topbar">
          <button
            className="icon-btn mobile-menu"
            onClick={() => setShowMobileMenu(true)}
            aria-label="Open menu"
          >
            <Menu size={21} />
          </button>

          <div className="location-control">
            <MapPin size={17} />
            <span>{location}</span>
          </div>

          <div className="topbar-actions">
            {/* Language Switcher */}
            <button
              className="language-toggle"
              onClick={() => {
                if (lang === "kn") setLang("en");
                else if (lang === "en") setLang("hi");
                else setLang("kn");
              }}
            >
              <Languages size={16} /> {lang.toUpperCase()} (
              {lang === "kn" ? "ಕನ್ನಡ" : lang === "hi" ? "हिंदी" : "English"})
            </button>

            {/* Business Register Quick CTA */}
            <button
              className="primary-button"
              style={{ padding: "7px 12px", fontSize: "11px", margin: 0 }}
              onClick={() => setIsBusinessModalOpen(true)}
            >
              <Building2 size={15} /> {lang === "kn" ? "+ ವ್ಯಾಪಾರ ನೋಂದಣಿ" : "+ Register Business"}
            </button>

            <button
              className="avatar small-avatar"
              aria-label="Open profile"
              onClick={() => setIsAuthModalOpen(true)}
            >
              {currentUser ? currentUser.name.substring(0, 2).toUpperCase() : <UserIcon size={14} />}
            </button>
          </div>
        </header>

        <div className="page-wrap">
          {/* Welcome Banner with Real Voice Trigger */}
          <section className="welcome-row">
            <div>
              <p className="eyebrow">
                {lang === "kn" ? "ಲೈವ್ ಮಾರುಕಟ್ಟೆ ನಾಡಿ" : "SATURDAY, 24 OCTOBER 2026"}
              </p>
              <h1>
                {currentUser
                  ? `ನಮಸ್ಕಾರ, ${currentUser.name}.`
                  : lang === "kn"
                  ? "ನಮಸ್ಕಾರ, ರೈತ ಮಿತ್ರ."
                  : "Good morning, Farmer."}
              </h1>
              <p className="welcome-copy">
                {lang === "kn"
                  ? "ಇಂದಿನ ಕೊಯ್ಲಿಗೆ ನ್ಯಾಯಯುತ ದರ ಕಂಡುಕೊಳ್ಳಿ. ನೇರ ಖರೀದಿದಾರರೊಂದಿಗೆ ಸಂಪರ್ಕ ಸಾಧಿಸಿ."
                  : "Know your crop's worth. Find verified buyers and fair APMC benchmarks for today's harvest."}
              </p>
            </div>
            <button className="voice-button" onClick={() => setIsVoiceModalOpen(true)}>
              <span className="voice-orb">
                <Mic size={22} />
              </span>
              <span>
                {t.askKrishiSetu}
                <small>{t.speakInLanguage}</small>
              </span>
              <ChevronRight size={18} />
            </button>
          </section>

          {/* VIEW: Home */}
          {active === "Home" && (
            <>
              <section className="hero-grid">
                <div className="hero-card">
                  <div className="hero-copy">
                    <span className="status-pill live">
                      <i /> {t.marketPulseToday}
                    </span>
                    <h2>
                      {lang === "kn" ? "ಟೊಮೇಟೊ ದರ" : "Tomatoes are"}
                      <br />
                      <em>{lang === "kn" ? "ಏರಿಕೆಯಲ್ಲಿದೆ." : "moving up."}</em>
                    </h2>
                    <p>
                      {lang === "kn"
                        ? "ಕಳೆದ 14 ದಿನಗಳಲ್ಲಿ ದಾವಣಗೆರೆ APMC ಯಲ್ಲಿ ಮಾದರಿ ದರ 11.4% ಹೆಚ್ಚಾಗಿದೆ. ಇಂದು ನಿಮಗೆ ಉತ್ತಮ ಆಯ್ಕೆಗಳಿವೆ."
                        : "Local modal prices are up 11.4% over the last 14 days. You have strong selling options today."}
                    </p>
                    <button
                      className="primary-button"
                      onClick={() => setActive("Compare prices")}
                    >
                      {t.checkCropPrice} <ChevronRight size={17} />
                    </button>
                  </div>
                  <div className="mini-chart" aria-label="14 day price trend">
                    <span className="chart-label">
                      {mandiBenchmark === null ? "Live data unavailable" : `₹${mandiBenchmark}/kg`} <small>{mandiBenchmark === null ? "data.gov.in" : t.modalToday}</small>
                    </span>
                    <svg viewBox="0 0 280 150" role="img" aria-label="Rising price chart">
                      <path
                        d="M0 120 C22 115 25 104 48 108 S75 88 94 98 S119 77 141 82 S161 64 181 71 S210 37 229 49 S259 21 280 30"
                        fill="none"
                        stroke="#d6eb65"
                        strokeWidth="4"
                        strokeLinecap="round"
                      />
                      <path
                        d="M0 120 C22 115 25 104 48 108 S75 88 94 98 S119 77 141 82 S161 64 181 71 S210 37 229 49 S259 21 280 30 V150 H0Z"
                        fill="url(#fill)"
                        opacity=".18"
                      />
                      <defs>
                        <linearGradient id="fill" x1="0" x2="0" y1="0" y2="1">
                          <stop stopColor="#d6eb65" />
                          <stop offset="1" stopColor="#d6eb65" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="chart-axis">
                      <span>14 days ago</span>
                      <span>Today</span>
                    </div>
                  </div>
                </div>

                <div className="benchmark-card">
                  <div className="card-topline">
                    <span>{t.benchmarkRange}</span>
                    <span className="info-dot">i</span>
                  </div>
                  <div className="range-price">
                    {mandiBenchmark === null ? "Unavailable" : `₹${Math.floor(mandiBenchmark - 2.5)} — ₹${Math.ceil(mandiBenchmark + 3.5)}`}
                  </div>
                  <p>
                    {lang === "kn"
                      ? "ಪ್ರತಿ ಕೆಜಿ · ಟೊಮೇಟೊ · ಗ್ರೇಡ್ A"
                      : "per kg · Tomato · Grade A"}
                  </p>
                  <div className="range-bar">
                    <i />
                    <b />
                  </div>
                  <div className="range-labels">
                    {mandiBenchmark === null ? <span>Waiting for source data</span> : <><span>Min ₹{mandiBenchmark - 3.5}</span><strong>Modal ₹{mandiBenchmark}</strong><span>Max ₹{mandiBenchmark + 4.5}</span></>}
                  </div>
                  <div className="source-row">
                    <ShieldCheck size={15} />{" "}
                    <span>{mandiSource}</span>
                  </div>
                </div>
              </section>

              {/* Fair Price Quick Calculator */}
              <section className="section-heading">
                <div>
                  <p className="eyebrow">{t.makeADecision}</p>
                  <h2>{t.isOfferFair}</h2>
                </div>
                <button
                  className="text-button"
                  onClick={() => setActive("Compare prices")}
                >
                  {t.openAdvisor} <ChevronRight size={16} />
                </button>
              </section>

              <section className="advisor-card">
                <div className="advisor-icon">
                  <Store size={20} />
                </div>
                <div className="advisor-input">
                  <label>{t.vendorOffer}</label>
                  <div className="input-wrap">
                    <span>₹</span>
                    <input
                      type="number"
                      value={quote}
                      onChange={(e) => setQuote(Number(e.target.value))}
                      aria-label="Vendor offer price"
                    />
                    <span className="unit">/ kg</span>
                  </div>
                </div>
                <div className="advisor-divider" />
                <div className="advisor-result">
                  <span className="result-label">{t.comparedToBenchmark}</span>
                  <strong className={quoteDelta !== null && quoteDelta < -1 ? "below" : "good"}>
                    {quoteDelta === null
                      ? "No comparable live data"
                      : quoteDelta < -1
                      ? lang === "kn"
                        ? "ಮಂಡಿ ದರಕ್ಕಿಂತ ಕಡಿಮೆಯಿದೆ"
                        : "Below comparable range"
                      : lang === "kn"
                      ? "ಉತ್ತಮ ಮಾರುಕಟ್ಟೆ ದರ"
                      : "Within comparable range"}
                  </strong>
                  <span>
                    {quoteDelta === null
                      ? mandiSource
                      : quoteDelta < -1
                      ? `₹${Math.abs(quoteDelta).toFixed(1)}/kg below ₹${mandiBenchmark}/kg APMC modal`
                      : "Confirm pickup logistics and payment terms"}
                  </span>
                </div>
                <button
                  className="outline-button"
                  onClick={() => setActive("Compare prices")}
                >
                  {t.seeComparison} <ChevronRight size={16} />
                </button>
              </section>

              {/* Nearby Buyers Section */}
              <section className="section-heading buyers-heading">
                <div>
                  <p className="eyebrow">{t.currentBuyingReqs}</p>
                  <h2>{t.nearbyBuyersRanked}</h2>
                </div>
                <button
                  className="text-button"
                  onClick={() => setActive("Find buyers")}
                >
                  {t.viewAllBuyers} <ChevronRight size={16} />
                </button>
              </section>

              <section className="buyers-grid">
                {buyersList.map((buyer) => (
                  <BuyerCard
                    key={buyer.id || buyer.name}
                    buyer={buyer}
                    quantity={quantity}
                    onContact={() => setSelectedBuyerForEnquiry(buyer)}
                    currentUser={currentUser}
                  />
                ))}
              </section>
            </>
          )}

          {/* VIEW: Compare Prices & Fair Price Advisor */}
          {active === "Compare prices" && (
            <CompareView
              quote={quote}
              setQuote={setQuote}
              quantity={quantity}
              setQuantity={setQuantity}
              comparable={mandiBenchmark}
              crop={crop}
              onCropChange={handleCropChange}
              source={mandiSource}
              onListen={() => setIsVoiceModalOpen(true)}
              onContactBuyer={(buyer) => setSelectedBuyerForEnquiry(buyer)}
              nearbyBuyers={buyersList}
            />
          )}

          {/* VIEW: Find Buyers & 2dsphere Geospatial Discovery */}
          {active === "Find buyers" && (
            <BuyersView
              visibleBuyers={buyersList}
              radius={radius}
              setRadius={(r) => {
                setRadius(r);
                fetchNearbyBuyers(userCoords, district);
              }}
              quantity={quantity}
              setQuantity={setQuantity}
              onGps={useGps}
              gpsMessage={gpsMessage}
              onContact={(buyer) => setSelectedBuyerForEnquiry(buyer)}
              onOpenRegister={() => setIsBusinessModalOpen(true)}
              loading={loadingBuyers}
              mapCenter={mapCenter}
              locationLabel={location}
              currentUser={currentUser}
            />
          )}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="bottom-nav">
        {navItems.map(({ label, icon: Icon, id }) => (
          <button
            key={id}
            className={active === id ? "active" : ""}
            onClick={() => {
              if (id === "Register business") setIsBusinessModalOpen(true);
              else setActive(id);
            }}
          >
            <Icon size={20} />
            <span>{label.split(" ")[0]}</span>
          </button>
        ))}
      </nav>

      {/* Interactive Modals */}
      <BusinessRegistrationModal
        isOpen={isBusinessModalOpen}
        onClose={() => setIsBusinessModalOpen(false)}
        onSuccess={() => fetchNearbyBuyers(userCoords, district)}
      />

      <SendEnquiryModal
        buyer={selectedBuyerForEnquiry}
        isOpen={Boolean(selectedBuyerForEnquiry)}
        onClose={() => setSelectedBuyerForEnquiry(null)}
        onSuccess={() => setActive("Home")}
      />

      <VoiceAssistantModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        language={lang === "kn" ? "kn" : "en"}
        district={district || undefined}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={(u) => setCurrentUser(u)}
      />
    </div>
  );
}

function BuyerCard({
  buyer,
  quantity,
  onContact,
  currentUser,
}: {
  buyer: Buyer;
  quantity: number;
  onContact: () => void;
  currentUser: any;
}) {
  const distKm = buyer.distanceKm || Number.parseInt(buyer.distance) || 15;
  const netEarnings = buyer.price * quantity - quantity * 1.2 - distKm * 8;

  const handleDownloadCSV = () => {
    const farmerName = currentUser?.name || "Unknown Farmer";
    const farmerDistrict = currentUser?.district || "Unknown District";
    const farmerPhone = currentUser?.phone || "Unknown Phone";
    
    const csvContent = `Buyer Name,Buyer Phone,Buyer Category,Buyer District,Buyer Price,Farmer Name,Farmer District,Farmer Phone,Source\n${buyer.name},${buyer.phone || "N/A"},${buyer.category},${buyer.district || "N/A"},${buyer.price},${farmerName},${farmerDistrict},${farmerPhone},"AGMARKNET CSV"`;
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `apmc_farmer_contact_${buyer.name.replace(/\s+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <article className="buyer-card">
      <div className={`buyer-accent ${buyer.accent || "mint"}`} />
      <div className="buyer-card-body">
        <div className="buyer-heading">
          <div className="buyer-logo">
            <Store size={20} />
          </div>
          <div>
            <h3>{buyer.name}</h3>
            <p>
              {buyer.category} · {buyer.distance}
            </p>
          </div>
          <button className="more-button" aria-label={`More about ${buyer.name}`}>
            •••
          </button>
        </div>

        <div className="buyer-offer">
          <div>
            <span className="small-label">CURRENT OFFER</span>
            <strong>
              ₹{buyer.price}
              <small>/kg</small>
            </strong>
          </div>
          <div>
            <span className="small-label">EST. TAKE-HOME</span>
            <strong className="take-home">{money(netEarnings)}</strong>
          </div>
        </div>

        <div className="buyer-meta">
          <span>
            {buyer.isMarketReference ? <TrendingUp size={14} /> : buyer.verified ? <ShieldCheck size={14} /> : <CircleHelp size={14} />}
            {buyer.isMarketReference ? "Mandi benchmark" : buyer.verified ? "Verified business" : "Pending verification"}
          </span>
          <span>
            <Navigation size={14} /> {buyer.pickup}
          </span>
        </div>

        <div className="buyer-footer">
          <div className="buyer-actions">
            <button className="primary-button" onClick={handleDownloadCSV}>
              <Download size={14} /> Get APMC Details
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function CompareView({
  quote,
  setQuote,
  quantity,
  setQuantity,
  comparable,
  crop,
  onCropChange,
  source,
  onListen,
  onContactBuyer,
  nearbyBuyers,
}: {
  quote: number;
  setQuote: (v: number) => void;
  quantity: number;
  setQuantity: (v: number) => void;
  comparable: number | null;
  crop: string;
  onCropChange: (value: string) => void;
  source: string;
  onListen: () => void;
  onContactBuyer: (b: Buyer) => void;
  nearbyBuyers: Buyer[];
}) {
  const handlingCost = quantity * 1.2;
  const net = quote * quantity - handlingCost;
  const bestBuyer = nearbyBuyers.length > 0 ? nearbyBuyers[0] : null;
  const hasComparable = comparable !== null;

  return (
    <>
      <section className="subpage-header">
        <div>
          <p className="eyebrow">FAIR PRICE ADVISOR & CALCULATOR</p>
          <h2>Check your vendor&apos;s offer</h2>
          <p>
            We compare your quote with official AGMARKNET modal benchmarks and active verified buyer requirements.
          </p>
        </div>
        <button className="listen-button" onClick={onListen}>
          <Volume2 size={17} /> Listen to comparison (ಕನ್ನಡದಲ್ಲಿ ಕೇಳಿ)
        </button>
      </section>

      <section className="comparison-layout">
        <div className="form-card">
          <div className="card-title">
            <Sprout size={19} />
            <h3>Your crop details</h3>
          </div>

          <label>
            Crop and grade
            <select value={crop} onChange={(event) => onCropChange(event.target.value)}>
              <option value="Tomato">Tomato · Grade A</option>
              <option value="Brinjal">Brinjal</option>
              <option value="Cabbage">Cabbage</option>
              <option value="Green Chilli">Green Chilli</option>
              <option value="Onion">Onion</option>
              <option value="Potato">Potato</option>
              <option value="Maize">Maize</option>
              <option value="Wheat">Wheat</option>
            </select>
          </label>

          <label>
            Quantity (kg)
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </label>

          <label>
            Vendor&apos;s quoted price (₹/kg)
            <div className="input-wrap large">
              <span>₹</span>
              <input
                type="number"
                value={quote}
                onChange={(e) => setQuote(Number(e.target.value))}
              />
              <span className="unit">/ kg</span>
            </div>
          </label>

          <label>
            Farm Location
            <select>
              <option>Davanagere, Karnataka</option>
              <option>Harihar, Karnataka</option>
              <option>Hubballi, Karnataka</option>
            </select>
          </label>
        </div>

        <div className="comparison-result">
          <div className="result-banner">
            <div className="result-status">
              <span className="result-symbol">{!hasComparable ? "!" : quote < comparable - 1 ? "↓" : "✓"}</span>
              <div>
                <span className="small-label">YOUR QUOTE IS</span>
                <h3>
                  {!hasComparable
                    ? "No live benchmark available"
                    : quote < comparable - 1
                    ? "Below the local benchmark"
                    : "Within the local benchmark"}
                </h3>
              </div>
            </div>
            <p>
              {!hasComparable
                ? "The live data.gov.in market source did not return a comparable record. Verify the source configuration before negotiating on this result."
                : quote < comparable - 1
                ? `This quote is ₹${(comparable - quote).toFixed(1)}/kg lower than the current AGMARKNET modal reference (₹${comparable}/kg). You could ask the vendor to match or contact nearby verified buyers.`
                : "This quote aligns closely with current mandi ranges. Confirm final crate weighing, transport deduction and immediate electronic payment terms."}
            </p>
          </div>

          <div className="comparison-row">
            <span>Your vendor quote</span>
            <strong>₹{quote.toFixed(1)}/kg</strong>
          </div>

          <div className="comparison-row">
            <span>
              Live market benchmark <small>{source}</small>
            </span>
            <strong>{hasComparable ? `₹${comparable.toFixed(1)}/kg` : "Unavailable"}</strong>
          </div>

          {bestBuyer && (
            <div className="comparison-row">
              <span>
                {bestBuyer.name}{" "}
                <small>{bestBuyer.pickup} · Verified buyer</small>
              </span>
              <strong className="green-text">₹{bestBuyer.price}/kg</strong>
            </div>
          )}

          <div className="net-card">
            <span>Estimated net at your quote</span>
            <strong>{money(net)}</strong>
            <small>
              {quantity} kg · after ₹1.20/kg handling · transport estimated separately
            </small>
          </div>

          {bestBuyer && (
            <div style={{ marginTop: "18px" }}>
              <button
                className="primary-button"
                style={{ width: "100%" }}
                onClick={() => onContactBuyer(bestBuyer)}
              >
                <Send size={15} /> Contact Best Buyer ({bestBuyer.name} at ₹{bestBuyer.price}/kg)
              </button>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function BuyersView({
  visibleBuyers,
  radius,
  setRadius,
  quantity,
  setQuantity,
  onGps,
  gpsMessage,
  onContact,
  onOpenRegister,
  loading,
  mapCenter,
  locationLabel,
  currentUser,
}: {
  visibleBuyers: Buyer[];
  radius: number;
  setRadius: (v: number) => void;
  quantity: number;
  setQuantity: (v: number) => void;
  onGps: () => void;
  gpsMessage: string;
  onContact: (b: Buyer) => void;
  onOpenRegister: () => void;
  loading: boolean;
  mapCenter: [number, number];
  locationLabel: string;
  currentUser: any;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [mandiLocations, setMandiLocations] = useState<any[]>([]);

  // Load mandi locations from CSV
  useEffect(() => {
    // Static mandi locations data (embedded to avoid path issues)
    const mandiData: Array<{
      record_id: number;
      mandi_name: string;
      district: string;
      state: string;
      price: number;
      take_home: number;
      latitude: number;
      longitude: number;
    }> = [
      { record_id: 1, mandi_name: "Mayabander Vegetable Market", district: "North and Middle Andaman", state: "Andaman and Nicobar Islands", price: 80, take_home: 39280, latitude: 12.924, longitude: 92.896 },
      { record_id: 2, mandi_name: "Manubazar", district: "South Tripura", state: "Tripura", price: 66, take_home: 32280, latitude: 23.045, longitude: 91.615 },
      { record_id: 3, mandi_name: "Gondatwisa APMC", district: "Dhalai", state: "Tripura", price: 65, take_home: 31780, latitude: 23.936, longitude: 91.857 },
      { record_id: 4, mandi_name: "Palakkad Market", district: "Palakad", state: "Kerala", price: 56, take_home: 27280, latitude: 10.7867, longitude: 76.6548 },
      { record_id: 5, mandi_name: "Vadakkenchery Market", district: "Palakad", state: "Kerala", price: 55, take_home: 26780, latitude: 10.594, longitude: 76.487 },
      { record_id: 6, mandi_name: "Damnagar APMC", district: "Amreli", state: "Gujarat", price: 55, take_home: 26780, latitude: 21.692, longitude: 71.517 },
      { record_id: 7, mandi_name: "Broadway market Market", district: "Ernakulam", state: "Kerala", price: 52, take_home: 25280, latitude: 9.9816, longitude: 76.2744 },
      { record_id: 8, mandi_name: "Kalyanpur APMC", district: "Khowai", state: "Tripura", price: 51, take_home: 24780, latitude: 24.067, longitude: 91.626 },
      { record_id: 9, mandi_name: "Anchal Market", district: "Kollam", state: "Kerala", price: 50, take_home: 24280, latitude: 8.92969, longitude: 76.90843 },
      { record_id: 10, mandi_name: "Perambalur(Uzhavar Sandhai)", district: "Perambalur", state: "Tamil Nadu", price: 50, take_home: 24280, latitude: 11.2342, longitude: 78.8807 },
      { record_id: 11, mandi_name: "Sankarapuram(Uzhavar Sandhai)", district: "Kallakurichi", state: "Tamil Nadu", price: 48, take_home: 23280, latitude: 11.887, longitude: 78.929 },
      { record_id: 12, mandi_name: "Kallakurichi(Uzhavar Sandhai)", district: "Kallakurichi", state: "Tamil Nadu", price: 48, take_home: 23280, latitude: 11.7401, longitude: 78.9597 },
      { record_id: 13, mandi_name: "Pattukottai(Uzhavar Sandhai)", district: "Thanjavur", state: "Tamil Nadu", price: 48, take_home: 23280, latitude: 10.4236, longitude: 79.3197 },
      { record_id: 14, mandi_name: "Angamaly Market", district: "Ernakulam", state: "Kerala", price: 48, take_home: 23280, latitude: 10.196, longitude: 76.386 },
      { record_id: 15, mandi_name: "Pallapatti (Uzhavar Sandhai)", district: "Karur", state: "Tamil Nadu", price: 47.5, take_home: 23030, latitude: 10.722, longitude: 78.148 },
      { record_id: 16, mandi_name: "Chinnalapatti(Uzhavar Sandhai)", district: "Dindigul", state: "Tamil Nadu", price: 47.5, take_home: 23030, latitude: 10.301, longitude: 77.941 },
      { record_id: 17, mandi_name: "Sathur(Uzhavar Sandhai)", district: "Virudhunagar", state: "Tamil Nadu", price: 47.5, take_home: 23030, latitude: 9.364, longitude: 77.924 },
      { record_id: 18, mandi_name: "Rasipuram(Uzhavar Sandhai)", district: "Namakkal", state: "Tamil Nadu", price: 47, take_home: 22780, latitude: 11.46, longitude: 78.186 },
      { record_id: 19, mandi_name: "Melapalayam(Uzhavar Sandhai)", district: "Tirunelveli", state: "Tamil Nadu", price: 47, take_home: 22780, latitude: 8.713, longitude: 77.713 },
      { record_id: 20, mandi_name: "Kandiyaperi(Uzhavar Sandhai)", district: "Tirunelveli", state: "Tamil Nadu", price: 47, take_home: 22780, latitude: 8.746, longitude: 77.69 },
      { record_id: 21, mandi_name: "Palayamkottai(Uzhavar Sandhai)", district: "Tirunelveli", state: "Tamil Nadu", price: 47, take_home: 22780, latitude: 8.728, longitude: 77.708 },
      { record_id: 22, mandi_name: "Karaikudi(Uzhavar Sandhai)", district: "Sivagangai", state: "Tamil Nadu", price: 46.5, take_home: 22530, latitude: 10.073, longitude: 78.78 },
      { record_id: 23, mandi_name: "Coonoor(Uzhavar Sandhai)", district: "The Nilgiris", state: "Tamil Nadu", price: 46.5, take_home: 22530, latitude: 11.353, longitude: 76.795 },
      { record_id: 24, mandi_name: "Tirupatthur(Uzhavar Sandhai)", district: "Sivagangai", state: "Tamil Nadu", price: 46.5, take_home: 22530, latitude: 10.115, longitude: 78.6 },
      { record_id: 25, mandi_name: "Devakottai (Uzhavar Sandhai)", district: "Sivagangai", state: "Tamil Nadu", price: 46.5, take_home: 22530, latitude: 9.947, longitude: 78.824 },
      { record_id: 26, mandi_name: "Peravurani(Uzhavar Sandhai)", district: "Thanjavur", state: "Tamil Nadu", price: 46, take_home: 22280, latitude: 10.292, longitude: 79.202 },
      { record_id: 27, mandi_name: "Panichowki", district: "Unokoti", state: "Tripura", price: 46, take_home: 22280, latitude: 24.327, longitude: 92.013 },
      { record_id: 28, mandi_name: "Sonamura APMC", district: "Sepahijala", state: "Tripura", price: 46, take_home: 22280, latitude: 23.475, longitude: 91.266 },
      { record_id: 29, mandi_name: "Mohanur(Uzhavar Sandhai)", district: "Namakkal", state: "Tamil Nadu", price: 45, take_home: 21780, latitude: 11.059, longitude: 78.139 },
      { record_id: 30, mandi_name: "Kattappana Market", district: "Idukki", state: "Kerala", price: 45, take_home: 21780, latitude: 9.754, longitude: 77.116 },
      { record_id: 31, mandi_name: "Dindigul(Uzhavar Sandhai)", district: "Dindigul", state: "Tamil Nadu", price: 45, take_home: 21780, latitude: 10.367, longitude: 77.98 },
      { record_id: 32, mandi_name: "Natrampalli(Uzhavar Sandhai)", district: "Thirupathur", state: "Tamil Nadu", price: 45, take_home: 21780, latitude: 12.582, longitude: 78.518 },
      { record_id: 33, mandi_name: "Thiruchengodu RM", district: "Namakkal", state: "Tamil Nadu", price: 45, take_home: 21780, latitude: 11.38, longitude: 77.894 },
      { record_id: 34, mandi_name: "Paramathivelur(Uzhavar Sandhai)", district: "Namakkal", state: "Tamil Nadu", price: 44, take_home: 21280, latitude: 11.108, longitude: 78.002 },
      { record_id: 35, mandi_name: "Tamarainagar(Uzhavar Sandhai)", district: "Thiruvannamalai", state: "Tamil Nadu", price: 44, take_home: 21280, latitude: 12.232, longitude: 79.074 },
      { record_id: 36, mandi_name: "Thanjavur(Uzhavar Sandhai)", district: "Thanjavur", state: "Tamil Nadu", price: 44, take_home: 21280, latitude: 10.787, longitude: 79.137 },
      { record_id: 37, mandi_name: "Singampunari(Uzhavar Sandhai)", district: "Sivagangai", state: "Tamil Nadu", price: 44, take_home: 21280, latitude: 10.188, longitude: 78.568 },
      { record_id: 38, mandi_name: "Sivagangai (Uzhavar Sandhai)", district: "Sivagangai", state: "Tamil Nadu", price: 44, take_home: 21280, latitude: 9.843, longitude: 78.48 },
      { record_id: 39, mandi_name: "NGO Colony(Uzhavar Sandhai)", district: "Tirunelveli", state: "Tamil Nadu", price: 44, take_home: 21280, latitude: 8.728, longitude: 77.708 },
      { record_id: 40, mandi_name: "Chathanoor Market", district: "Kollam", state: "Kerala", price: 44, take_home: 21280, latitude: 8.958, longitude: 76.917 },
      { record_id: 41, mandi_name: "Usilampatti(Uzhavar Sandhai)", district: "Madurai", state: "Tamil Nadu", price: 44, take_home: 21280, latitude: 9.969, longitude: 77.787 },
    ];
    setMandiLocations(mandiData);
  }, []);

  const filtered = visibleBuyers.filter(
    (b) =>
      b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.district && b.district.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <>
      <section className="subpage-header">
        <div>
          <p className="eyebrow">BUYER DISCOVERY & DIRECT TRADE</p>
          <h2>Find verified crop buyers near you</h2>
          <p>
            Real-time geospatial search within {radius} km radius using MongoDB 2dsphere coordinates.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button className="outline-button" onClick={onOpenRegister}>
            <Building2 size={16} /> Register as Buyer
          </button>
          <button className="gps-button" onClick={onGps}>
            <Crosshair size={17} /> Use GPS Location
          </button>
        </div>
      </section>

      {gpsMessage && (
        <div className="notice">
          <MapPin size={16} /> {gpsMessage}
        </div>
      )}

      <section className="discovery-layout">
        {/* Visual Map Surface */}
        <div className="map-panel">
          <div className="map-toolbar">
            <span>
              <MapPin size={15} /> {locationLabel} & nearby districts
            </span>
            <button onClick={onGps}>
              <Filter size={15} /> {radius} km radius
            </button>
          </div>
          <div className="map-surface real-map-surface">
            <MapView
              center={mapCenter} // Use actual user location center
              zoom={5} // Lower zoom to show all India
              userLocation={mapCenter} // Pass user location for "YOU" marker
              markers={[
                // Buyer markers
                ...filtered.flatMap((buyer): Array<{
                  lat: number;
                  lng: number;
                  title: string;
                  description: string;
                  isVerified: boolean;
                  price: number;
                  onClick: () => void;
                  type: "buyer";
                }> => {
                  if (!buyer.coordinates) return [];
                  return [{
                    lat: buyer.coordinates[1],
                    lng: buyer.coordinates[0],
                    title: buyer.name,
                    description: `${buyer.category} · ${buyer.distance}`,
                    isVerified: buyer.verified,
                    price: buyer.price,
                    onClick: () => onContact(buyer),
                    type: "buyer",
                  }];
                }),
                // Mandi location markers
                ...mandiLocations.map((mandi): {
                  lat: number;
                  lng: number;
                  title: string;
                  description: string;
                  isVerified: boolean;
                  price: number;
                  type: "mandi";
                } => ({
                  lat: mandi.latitude,
                  lng: mandi.longitude,
                  title: mandi.mandi_name,
                  description: `${mandi.district}, ${mandi.state} · ₹${mandi.price}/kg`,
                  isVerified: true,
                  price: mandi.price,
                  type: "mandi",
                })),
              ]}
            />
          </div>
          <div className="map-legend">
            <span>
              <i className="dot green-dot" /> Verified buyer
            </span>
            <span>
              <i className="dot amber-dot" /> Pending verification
            </span>
            <span>
              <i className="dot clay-dot" /> Mandi location
            </span>
            <span>
              <Navigation size={13} /> Approx. straight-line distance
            </span>
          </div>
        </div>

        {/* Directory Controls & List */}
        <div className="directory-panel">
          <div className="directory-controls">
            <div className="search-field">
              <Search size={17} />
              <input
                placeholder="Search by buyer, category or district..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                aria-label="Search buyers"
              />
            </div>
            <select
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              aria-label="Search radius"
            >
              <option value={10}>Within 10 km</option>
              <option value={25}>Within 25 km</option>
              <option value={50}>Within 50 km</option>
              <option value={100}>Within 100 km</option>
            </select>
            <div className="quantity-control">
              <label>Your quantity</label>
              <div>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                />
                <span>kg</span>
              </div>
            </div>
          </div>

          <div className="directory-count">
            <strong>
              {loading ? "Searching buyers..." : `${filtered.length} matching buyers`}
            </strong>
            <span>Ranked by take-home net return</span>
          </div>

          {filtered.map((buyer) => (
            <BuyerCard
              key={buyer.id || buyer.name}
              buyer={buyer}
              quantity={quantity}
              onContact={() => onContact(buyer)}
              currentUser={currentUser}
            />
          ))}
        </div>
      </section>
    </>
  );
}
