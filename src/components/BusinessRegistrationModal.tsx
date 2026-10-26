"use client";

import { useState } from "react";
import { Sprout, Building2, MapPin, Truck, IndianRupee, ShieldCheck, CheckCircle2, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";

const CATEGORIES = [
  { id: "local_vendor", label: "Local Vendor / Mandi Agent" },
  { id: "wholesaler", label: "Wholesale Trader" },
  { id: "retailer", label: "Retail Chain / Supermarket" },
  { id: "distributor", label: "Distributor" },
  { id: "processor", label: "Food Processing Plant" },
  { id: "exporter", label: "Agri Exporter" },
  { id: "cooperative", label: "Farmers Cooperative / Society" },
  { id: "fpo", label: "Farmer Producer Organization (FPO)" },
  { id: "bulk_purchaser", label: "Bulk Institution / HoReCa" },
];

const CROPS_LIST = [
  "Tomato",
  "Onion",
  "Potato",
  "Green Chilli",
  "Maize",
  "Ragi",
  "Cotton",
  "Turmeric",
  "Ginger",
  "Arecanut",
  "Coconut",
  "Banana",
];

const DISTRICTS_KARNATAKA = [
  "Davanagere",
  "Harihar",
  "Dharwad",
  "Hubballi",
  "Belagavi",
  "Kolar",
  "Chitradurga",
  "Shivamogga",
  "Haveri",
  "Bellary",
  "Mandya",
  "Mysuru",
  "Tumakuru",
  "Bengaluru Rural",
];

export function BusinessRegistrationModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form State
  const [businessName, setBusinessName] = useState("");
  const [category, setCategory] = useState("wholesaler");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [locality, setLocality] = useState("");
  const [taluk, setTaluk] = useState("");
  const [district, setDistrict] = useState("Davanagere");
  const [state, setState] = useState("Karnataka");
  const [pincode, setPincode] = useState("577002");
  const [latitude, setLatitude] = useState(14.4644);
  const [longitude, setLongitude] = useState(75.9218);

  const [selectedCrops, setSelectedCrops] = useState<string[]>(["Tomato"]);
  const [minQuantityKg, setMinQuantityKg] = useState(100);
  const [maxQuantityKg, setMaxQuantityKg] = useState(5000);
  const [transportPreference, setTransportPreference] = useState<"pickup" | "delivery" | "both">("pickup");
  const [serviceCoverage, setServiceCoverage] = useState<"village" | "taluk" | "district" | "multiple_districts" | "statewide">("district");
  const [paymentTerms, setPaymentTerms] = useState("Immediate Cash/UPI upon pickup");
  const [description, setDescription] = useState("");
  const [consentToPublish, setConsentToPublish] = useState(true);

  if (!isOpen) return null;

  const toggleCrop = (crop: string) => {
    if (selectedCrops.includes(crop)) {
      if (selectedCrops.length > 1) {
        setSelectedCrops(selectedCrops.filter((c) => c !== crop));
      }
    } else {
      setSelectedCrops([...selectedCrops, crop]);
    }
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(Number(pos.coords.latitude.toFixed(6)));
        setLongitude(Number(pos.coords.longitude.toFixed(6)));
        setMessage({ type: "success", text: "GPS Coordinates populated for business location." });
      },
      () => {
        setMessage({ type: "error", text: "Location permission declined. Retaining entered district coordinates." });
      }
    );
  };

  const handleSubmit = async (isDraft = false) => {
    setLoading(true);
    setMessage(null);

    const payload = {
      businessName,
      category,
      contactPerson,
      phone,
      email,
      address,
      locality,
      taluk,
      district,
      state,
      pincode,
      latitude,
      longitude,
      cropsPurchased: selectedCrops,
      minQuantityKg,
      maxQuantityKg,
      preferredUnit: "kg",
      procurementFrequency: "daily",
      transportPreference,
      serviceCoverage,
      serviceDistricts: [district],
      paymentMethods: ["Cash", "UPI"],
      paymentTerms,
      description,
      consentToPublish,
      isDraft,
    };

    const res = await api.post("/businesses", payload);
    setLoading(false);

    if (res.success) {
      setMessage({
        type: "success",
        text: isDraft
          ? "Draft saved successfully."
          : "Business registered and submitted for verification! Your listing will be visible to nearby farmers.",
      });
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 1800);
    } else {
      setMessage({ type: "error", text: res.message || "Failed to register business. Please verify all inputs." });
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-container">
        <div className="modal-header">
          <div>
            <span className="modal-badge">
              <Building2 size={14} /> STEP {step} OF 3
            </span>
            <h2>Register Your Agri Business</h2>
            <p>Connect with farmers across Karnataka & receive direct crop availability.</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        {message && (
          <div className={`modal-notice ${message.type}`}>
            {message.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{message.text}</span>
          </div>
        )}

        <div className="modal-body">
          {step === 1 && (
            <div className="form-step">
              <h3>1. Business & Contact Information</h3>
              <div className="form-group">
                <label>Business Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Sahaja Fresh Foods / Ravi Wholesale"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Business Category *</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)}>
                    {CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Contact Person Name *</label>
                  <input
                    type="text"
                    placeholder="Owner / Procurement Manager"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Phone Number * (10-digit Indian Mobile)</label>
                  <input
                    type="tel"
                    placeholder="e.g. 9845012345"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Email Address (Optional)</label>
                  <input
                    type="email"
                    placeholder="contact@business.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="primary-button"
                  disabled={!businessName || !contactPerson || !phone}
                  onClick={() => setStep(2)}
                >
                  Continue to Location →
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="form-step">
              <h3>2. Physical Location & Service Coverage</h3>
              <div className="form-group">
                <label>Address / Mandi Shop Number *</label>
                <input
                  type="text"
                  placeholder="Shop No. 14, APMC Yard, PB Road"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>District *</label>
                  <select value={district} onChange={(e) => setDistrict(e.target.value)}>
                    {DISTRICTS_KARNATAKA.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>State *</label>
                  <input type="text" value={state} onChange={(e) => setState(e.target.value)} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Taluk / Locality</label>
                  <input
                    type="text"
                    placeholder="e.g. Harihar / Davanagere"
                    value={taluk}
                    onChange={(e) => setTaluk(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>PIN Code</label>
                  <input
                    type="text"
                    placeholder="577002"
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                  />
                </div>
              </div>

              <div className="geo-location-box">
                <div className="geo-info">
                  <MapPin size={18} />
                  <div>
                    <strong>Business GPS Coordinates (2dsphere index)</strong>
                    <span>Lat: {latitude}, Lng: {longitude}</span>
                  </div>
                </div>
                <button type="button" className="outline-button" onClick={handleUseCurrentLocation}>
                  Fetch GPS Location
                </button>
              </div>

              <div className="form-group">
                <label>Service Area Coverage</label>
                <select
                  value={serviceCoverage}
                  onChange={(e) => setServiceCoverage(e.target.value as any)}
                >
                  <option value="taluk">Local Taluk only</option>
                  <option value="district">Whole District</option>
                  <option value="multiple_districts">Neighboring Districts</option>
                  <option value="statewide">Statewide Karnataka</option>
                </select>
              </div>

              <div className="modal-actions split">
                <button type="button" className="outline-button" onClick={() => setStep(1)}>
                  ← Back
                </button>
                <button
                  type="button"
                  className="primary-button"
                  disabled={!address}
                  onClick={() => setStep(3)}
                >
                  Continue to Crops & Offers →
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="form-step">
              <h3>3. Crops Purchased & Procurement Terms</h3>
              <div className="form-group">
                <label>Select Crops You Purchase *</label>
                <div className="chips-container">
                  {CROPS_LIST.map((crop) => (
                    <button
                      key={crop}
                      type="button"
                      className={`chip-button ${selectedCrops.includes(crop) ? "active" : ""}`}
                      onClick={() => toggleCrop(crop)}
                    >
                      <Sprout size={13} /> {crop}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Min Purchase Qty (kg)</label>
                  <input
                    type="number"
                    value={minQuantityKg}
                    onChange={(e) => setMinQuantityKg(Number(e.target.value))}
                  />
                </div>
                <div className="form-group">
                  <label>Max Daily Capacity (kg)</label>
                  <input
                    type="number"
                    value={maxQuantityKg}
                    onChange={(e) => setMaxQuantityKg(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Transport & Pickup Preference</label>
                  <select
                    value={transportPreference}
                    onChange={(e) => setTransportPreference(e.target.value as any)}
                  >
                    <option value="pickup">Farm Gate Pickup Available</option>
                    <option value="delivery">Farmer Delivery to Mandi / Yard</option>
                    <option value="both">Both Options Negotiable</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Payment Terms & Schedule</label>
                  <input
                    type="text"
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Business Description / Quality Requirements</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Regular buyers of hybrid tomatoes. Immediate electronic settlement on weighing."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="form-checkbox">
                <input
                  type="checkbox"
                  id="consent"
                  checked={consentToPublish}
                  onChange={(e) => setConsentToPublish(e.target.checked)}
                />
                <label htmlFor="consent">
                  I consent to publishing this business listing so verified farmers in Karnataka can find and send crop enquiries.
                </label>
              </div>

              <div className="modal-actions split">
                <button type="button" className="outline-button" onClick={() => setStep(2)}>
                  ← Back
                </button>
                <div className="btn-group">
                  <button
                    type="button"
                    className="outline-button"
                    disabled={loading}
                    onClick={() => handleSubmit(true)}
                  >
                    Save Draft
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    disabled={loading || selectedCrops.length === 0}
                    onClick={() => handleSubmit(false)}
                  >
                    {loading ? "Submitting..." : "Submit for Verification ✓"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
