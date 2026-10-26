"use client";

import { useState } from "react";
import { Send, Store, Sprout, CheckCircle2, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";

export function SendEnquiryModal({
  buyer,
  isOpen,
  onClose,
  onSuccess,
}: {
  buyer: any;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const [crop, setCrop] = useState("Tomato");
  const [variety, setVariety] = useState("Hybrid");
  const [grade, setGrade] = useState("Grade A");
  const [quantity, setQuantity] = useState(500);
  const [unit, setUnit] = useState("kg");
  const [pickupLocation, setPickupLocation] = useState("Davanagere Rural");
  const [expectedDate, setExpectedDate] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  if (!isOpen || !buyer) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);

    const payload = {
      businessId: buyer.id || buyer._id,
      crop,
      variety,
      grade,
      quantity: Number(quantity),
      unit,
      expectedHarvestDate: expectedDate || undefined,
      pickupLocation,
      message,
      coordinatesConsent: false,
    };

    const res = await api.post("/enquiries", payload);
    setLoading(false);

    if (res.success) {
      setFeedback({
        type: "success",
        text: `Enquiry submitted to ${buyer.name || buyer.businessName}! The buyer has been notified and will send purchase terms.`,
      });
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 1600);
    } else {
      setFeedback({
        type: "error",
        text: res.message || "Failed to submit enquiry. Please ensure you are logged in.",
      });
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-container">
        <div className="modal-header">
          <div>
            <span className="modal-badge">
              <Store size={14} /> DIRECT BUYER ENQUIRY
            </span>
            <h2>Send Crop Offer to {buyer.name || buyer.businessName}</h2>
            <p>
              {buyer.category} · Located in {buyer.district}, {buyer.state}
            </p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        {feedback && (
          <div className={`modal-notice ${feedback.type}`}>
            {feedback.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{feedback.text}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-row">
            <div className="form-group">
              <label>Crop *</label>
              <select value={crop} onChange={(e) => setCrop(e.target.value)}>
                <option value="Tomato">Tomato (ಟೊಮೇಟೊ)</option>
                <option value="Onion">Onion (ಈರುಳ್ಳಿ)</option>
                <option value="Chilli">Green Chilli (ಮೆಣಸಿನಕಾಯಿ)</option>
                <option value="Maize">Maize (ಮೆಕ್ಕೆಜೋಳ)</option>
                <option value="Potato">Potato (ಆಲೂಗಡ್ಡೆ)</option>
              </select>
            </div>
            <div className="form-group">
              <label>Quality Grade</label>
              <select value={grade} onChange={(e) => setGrade(e.target.value)}>
                <option value="Grade A">Grade A (Premium / Firm)</option>
                <option value="Grade B">Grade B (Standard Market)</option>
                <option value="Mixed">Mixed Quality</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Available Quantity *</label>
              <div className="input-with-addon">
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  required
                />
                <select value={unit} onChange={(e) => setUnit(e.target.value)}>
                  <option value="kg">kg</option>
                  <option value="quintal">quintal (100kg)</option>
                  <option value="crate">crates (25kg)</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Ready for Pickup / Harvest Date</label>
              <input
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Pickup Location / Village *</label>
            <input
              type="text"
              value={pickupLocation}
              placeholder="Village, Taluk, Near Landmark"
              onChange={(e) => setPickupLocation(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Special Instructions / Notes</label>
            <textarea
              rows={2}
              placeholder="e.g. Freshly harvested hybrid tomato. Need pickup tomorrow morning."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          <div className="modal-actions split">
            <button type="button" className="outline-button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary-button" disabled={loading}>
              <Send size={15} /> {loading ? "Sending..." : "Submit Enquiry"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
