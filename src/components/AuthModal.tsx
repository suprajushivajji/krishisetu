"use client";

import { useState } from "react";
import { User, Lock, Phone, ArrowRight, ShieldCheck, CheckCircle2, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";

export function AuthModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: any) => void;
}) {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"farmer" | "buyer" | "admin">("farmer");
  const [district, setDistrict] = useState("Davanagere");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const endpoint = isRegister ? "/auth/register" : "/auth/login";
    const payload = isRegister
      ? { name, phone, password, role, district, preferredLanguage: "kn" }
      : { phone, password };

    const res = await api.post(endpoint, payload);
    setLoading(false);

    if (res.success) {
      api.setToken(res.token);
      setMessage({
        type: "success",
        text: isRegister ? "Account created successfully!" : "Logged in successfully!",
      });
      setTimeout(() => {
        onSuccess(res.user);
        onClose();
      }, 1000);
    } else {
      setMessage({ type: "error", text: res.message || "Authentication failed" });
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-container auth-modal-box">
        <div className="modal-header">
          <div>
            <span className="modal-badge">
              <ShieldCheck size={14} /> SECURE LOGIN
            </span>
            <h2>{isRegister ? "Join KrishiSetu" : "Log In to Your Account"}</h2>
            <p>
              {isRegister
                ? "Register as a Farmer or Buyer to access verified networks."
                : "Enter your 10-digit mobile number and password."}
            </p>
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

        <form onSubmit={handleSubmit} className="modal-body">
          {isRegister && (
            <>
              <div className="form-group">
                <label>Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Shivappa"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>I am a *</label>
                  <select value={role} onChange={(e) => setRole(e.target.value as any)}>
                    <option value="farmer">Farmer (ರೈತ)</option>
                    <option value="buyer">Business / Buyer (ವ್ಯಾಪಾರಿ)</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>District</label>
                  <input
                    type="text"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          <div className="form-group">
            <label>Phone Number * (10-digits)</label>
            <div className="input-with-icon">
              <Phone size={16} />
              <input
                type="tel"
                placeholder="9845012345"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Password *</label>
            <div className="input-with-icon">
              <Lock size={16} />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="modal-actions split">
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setIsRegister(!isRegister);
                setMessage(null);
              }}
            >
              {isRegister ? "Already registered? Log in" : "Need an account? Register"}
            </button>
            <button type="submit" className="primary-button" disabled={loading}>
              {loading ? "Processing..." : isRegister ? "Create Account" : "Log In"}{" "}
              <ArrowRight size={15} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
