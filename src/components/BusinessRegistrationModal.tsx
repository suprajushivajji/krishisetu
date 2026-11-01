"use client";

import { useRef, useState } from "react";
import { Sprout, Building2, MapPin, Mic, Keyboard, CheckCircle2, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";
import {
  CATEGORIES,
  CROPS_LIST,
  DISTRICTS_KARNATAKA,
  buildBusinessPayload,
  initialRegistrationState,
  validateForm,
  type RegistrationFormState,
  type TransportPreference,
  type ServiceCoverage,
} from "@/lib/registrationSchema";
import { VoiceRegistrationModal } from "./VoiceRegistrationModal";

type Mode = "choose" | "manual" | "voice";

export function BusinessRegistrationModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const [mode, setMode] = useState<Mode>("choose");
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Single source of truth for the whole registration (shared with the voice agent).
  const [form, setForm] = useState<RegistrationFormState>({ ...initialRegistrationState });

  // Prevent duplicate submissions from producing duplicate business records.
  const submittingRef = useRef(false);

  if (!isOpen) return null;

  const set = <K extends keyof RegistrationFormState>(key: K, value: RegistrationFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const toggleCrop = (crop: string) => {
    setForm((prev) => {
      if (prev.selectedCrops.includes(crop)) {
        if (prev.selectedCrops.length > 1) {
          return { ...prev, selectedCrops: prev.selectedCrops.filter((c) => c !== crop) };
        }
        return prev;
      }
      return { ...prev, selectedCrops: [...prev.selectedCrops, crop] };
    });
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((prev) => ({
          ...prev,
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
        }));
        setMessage({ type: "success", text: "GPS Coordinates populated for business location." });
      },
      () => {
        setMessage({ type: "error", text: "Location permission declined. Retaining entered district coordinates." });
      }
    );
  };

  // Core submission — used by BOTH manual and voice flows through the SAME API.
  const submitBusiness = async (isDraft = false): Promise<{ success: boolean; message?: string }> => {
    if (submittingRef.current) {
      return { success: false, message: "A submission is already in progress." };
    }
    // Final deterministic validation across the entire form.
    const errors = validateForm(form);
    if (!isDraft && errors.length > 0) {
      const msg = `Please fix: ${errors.map((e) => e.fieldId).join(", ")}`;
      setMessage({ type: "error", text: msg });
      return { success: false, message: msg };
    }

    submittingRef.current = true;
    setLoading(true);
    setMessage(null);

    const payload = buildBusinessPayload(form, isDraft);
    const res = await api.post("/businesses", payload);
    setLoading(false);
    submittingRef.current = false;

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
      return { success: true };
    }
    const errMsg = res.message || "Failed to register business. Please verify all inputs.";
    setMessage({ type: "error", text: errMsg });
    return { success: false, message: errMsg };
  };

  // ---------------------------------------------------------------- mode chooser
  if (mode === "choose") {
    return (
      <div className="modal-backdrop">
        <div className="modal-container">
          <div className="modal-header">
            <div>
              <span className="modal-badge">
                <Building2 size={14} /> REGISTER BUSINESS
              </span>
              <h2>Register Your Agri Business</h2>
              <p>Connect with farmers across Karnataka & receive direct crop availability.</p>
            </div>
            <button className="icon-btn" onClick={onClose} aria-label="Close modal">✕</button>
          </div>
          <div className="modal-body">
            <div className="reg-mode-grid">
              <button className="reg-mode-card" onClick={() => setMode("manual")}>
                <Keyboard size={26} />
                <strong>Fill form manually</strong>
                <span>Type your business details across the three steps.</span>
              </button>
              <button className="reg-mode-card accent" onClick={() => setMode("voice")}>
                <Mic size={26} />
                <strong>Fill form by voice</strong>
                <span>Answer questions aloud in Kannada, Hindi or English.</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------- manual form
  const manualBody = (
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
          <button className="icon-btn" onClick={onClose} aria-label="Close modal">✕</button>
        </div>

        {message && (
          <div className={`modal-notice ${message.type}`}>
            {message.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{message.text}</span>
          </div>
        )}

        <div className="modal-body">
          <div className="reg-mode-switch">
            <button className="text-link" onClick={() => setMode("voice")}>
              <Mic size={13} /> Register by voice instead
            </button>
          </div>

          {step === 1 && (
            <div className="form-step">
              <h3>1. Business & Contact Information</h3>
              <div className="form-group">
                <label>Business Name *</label>
                <input type="text" placeholder="e.g. Sahaja Fresh Foods / Ravi Wholesale" value={form.businessName} onChange={(e) => set("businessName", e.target.value)} required />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Business Category *</label>
                  <select value={form.category} onChange={(e) => set("category", e.target.value)}>
                    {CATEGORIES.map((c) => (<option key={c.id} value={c.id}>{c.label}</option>))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Contact Person Name *</label>
                  <input type="text" placeholder="Owner / Procurement Manager" value={form.contactPerson} onChange={(e) => set("contactPerson", e.target.value)} required />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Phone Number * (10-digit Indian Mobile)</label>
                  <input type="tel" placeholder="e.g. 9845012345" value={form.phone} onChange={(e) => set("phone", e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>Email Address (Optional)</label>
                  <input type="email" placeholder="contact@business.com" value={form.email} onChange={(e) => set("email", e.target.value)} />
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="primary-button" disabled={!form.businessName || !form.contactPerson || !form.phone} onClick={() => setStep(2)}>
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
                <input type="text" placeholder="Shop No. 14, APMC Yard, PB Road" value={form.address} onChange={(e) => set("address", e.target.value)} required />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>District *</label>
                  <select value={form.district} onChange={(e) => set("district", e.target.value)}>
                    {DISTRICTS_KARNATAKA.map((d) => (<option key={d} value={d}>{d}</option>))}
                  </select>
                </div>
                <div className="form-group">
                  <label>State *</label>
                  <input type="text" value={form.state} onChange={(e) => set("state", e.target.value)} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Taluk / Locality</label>
                  <input type="text" placeholder="e.g. Harihar / Davanagere" value={form.taluk} onChange={(e) => set("taluk", e.target.value)} />
                </div>
                <div className="form-group">
                  <label>PIN Code</label>
                  <input type="text" placeholder="577002" value={form.pincode} onChange={(e) => set("pincode", e.target.value)} />
                </div>
              </div>

              <div className="geo-location-box">
                <div className="geo-info">
                  <MapPin size={18} />
                  <div>
                    <strong>Business GPS Coordinates (2dsphere index)</strong>
                    <span>Lat: {form.latitude}, Lng: {form.longitude}</span>
                  </div>
                </div>
                <button type="button" className="outline-button" onClick={handleUseCurrentLocation}>Fetch GPS Location</button>
              </div>

              <div className="form-group">
                <label>Service Area Coverage</label>
                <select value={form.serviceCoverage} onChange={(e) => set("serviceCoverage", e.target.value as ServiceCoverage)}>
                  <option value="taluk">Local Taluk only</option>
                  <option value="district">Whole District</option>
                  <option value="multiple_districts">Neighboring Districts</option>
                  <option value="statewide">Statewide Karnataka</option>
                </select>
              </div>

              <div className="modal-actions split">
                <button type="button" className="outline-button" onClick={() => setStep(1)}>← Back</button>
                <button type="button" className="primary-button" disabled={!form.address} onClick={() => setStep(3)}>
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
                    <button key={crop} type="button" className={`chip-button ${form.selectedCrops.includes(crop) ? "active" : ""}`} onClick={() => toggleCrop(crop)}>
                      <Sprout size={13} /> {crop}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Min Purchase Qty (kg)</label>
                  <input type="number" value={form.minQuantityKg} onChange={(e) => set("minQuantityKg", Number(e.target.value))} />
                </div>
                <div className="form-group">
                  <label>Max Daily Capacity (kg)</label>
                  <input type="number" value={form.maxQuantityKg} onChange={(e) => set("maxQuantityKg", Number(e.target.value))} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Transport & Pickup Preference</label>
                  <select value={form.transportPreference} onChange={(e) => set("transportPreference", e.target.value as TransportPreference)}>
                    <option value="pickup">Farm Gate Pickup Available</option>
                    <option value="delivery">Farmer Delivery to Mandi / Yard</option>
                    <option value="both">Both Options Negotiable</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Payment Terms & Schedule</label>
                  <input type="text" value={form.paymentTerms} onChange={(e) => set("paymentTerms", e.target.value)} />
                </div>
              </div>

              <div className="form-group">
                <label>Business Description / Quality Requirements</label>
                <textarea rows={2} placeholder="e.g. Regular buyers of hybrid tomatoes. Immediate electronic settlement on weighing." value={form.description} onChange={(e) => set("description", e.target.value)} />
              </div>

              <div className="form-checkbox">
                <input type="checkbox" id="consent" checked={form.consentToPublish} onChange={(e) => set("consentToPublish", e.target.checked)} />
                <label htmlFor="consent">I consent to publishing this business listing so verified farmers in Karnataka can find and send crop enquiries.</label>
              </div>

              <div className="modal-actions split">
                <button type="button" className="outline-button" onClick={() => setStep(2)}>← Back</button>
                <div className="btn-group">
                  <button type="button" className="outline-button" disabled={loading} onClick={() => submitBusiness(true)}>Save Draft</button>
                  <button type="button" className="primary-button" disabled={loading || form.selectedCrops.length === 0} onClick={() => submitBusiness(false)}>
                    {loading ? "Submitting..." : "Submit for Verification ✓"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

            {/* Mounted only while in voice mode so the conversation machine restarts
          fresh from the latest form values every time voice is chosen. */}
      {mode === "voice" && (
        <VoiceRegistrationModal
          isOpen
          initialForm={form}
          onFormChange={(next) => setForm(next)}
          onSwitchToManual={() => setMode("manual")}
          onSubmit={() => submitBusiness(false)}
          onClose={() => setMode("choose")}
          submitting={loading}
        />
      )}
    </div>
  );

  return manualBody;
}
