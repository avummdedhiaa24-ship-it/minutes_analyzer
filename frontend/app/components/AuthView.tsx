import React, { useState } from "react";
import { 
  Building2, 
  Lock, 
  User, 
  Mail, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  ShieldCheck,
  CheckCircle,
  MapPin
} from "lucide-react";
import { authApi } from "../lib/api";

interface AuthViewProps {
  onAuthSuccess: (token: string, user: any) => void;
}

export default function AuthView({ onAuthSuccess }: AuthViewProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("Male");
  const [socialCategory, setSocialCategory] = useState("General");
  const [role, setRole] = useState("Citizen");
  const [village, setVillage] = useState("");
  const [block, setBlock] = useState("");
  const [district, setDistrict] = useState("");
  const [state, setState] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError("Please enter both username and password.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const data = await authApi.login(username, password);
      const token = data.access_token;
      // Fetch user profile info
      const userProfile = await authApi.getMe(token);
      onAuthSuccess(token, userProfile);
    } catch (err: any) {
      setError(err.message || "Invalid username or password.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !email || !password || !fullName) {
      setError("Username, Email, Password, and Full Name are required.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const signupData = {
        username,
        email,
        password,
        role,
        full_name: fullName,
        age: age ? parseInt(age) : undefined,
        gender,
        social_category: socialCategory,
        village,
        block,
        district,
        state
      };
      await authApi.signup(signupData);
      setSuccessMsg("Registration successful! Logging in...");
      // Auto login
      const data = await authApi.login(username, password);
      const token = data.access_token;
      const userProfile = await authApi.getMe(token);
      setTimeout(() => {
        onAuthSuccess(token, userProfile);
      }, 1000);
    } catch (err: any) {
      setError(err.message || "Failed to register user. Try another username/email.");
    } finally {
      setLoading(false);
    }
  };

  // Quick credentials logins for evaluation
  const handleQuickLogin = async (quickUser: string) => {
    setError("");
    setLoading(true);
    try {
      const data = await authApi.login(quickUser, "password123");
      const token = data.access_token;
      const userProfile = await authApi.getMe(token);
      onAuthSuccess(token, userProfile);
    } catch (err: any) {
      setError(`Quick Login failed for ${quickUser}: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background visual accents */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-white to-emerald-600"></div>
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl"></div>

      <div className="w-full max-w-xl space-y-8 z-10">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-gradient-to-br from-indigo-600 to-indigo-900 text-white rounded-2xl flex items-center justify-center shadow-lg border border-slate-700">
            <Building2 className="h-9 w-9 text-amber-400 animate-pulse" />
          </div>
          <h2 className="mt-4 text-3xl font-extrabold text-white tracking-tight">
            AI General Meeting Platform
          </h2>
          <p className="mt-2 text-sm text-slate-400 font-medium">
            AI Meeting Minutes & Cryptographic Decision Registry
          </p>
        </div>

        <div className="bg-slate-850/80 backdrop-blur-md border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
          {/* Tabs */}
          <div className="flex border-b border-slate-800 pb-4">
            <button
              onClick={() => {
                setIsRegister(false);
                setError("");
                setSuccessMsg("");
              }}
              className={`flex-1 text-center py-2 text-sm font-semibold transition-colors ${
                !isRegister ? "text-indigo-400 border-b-2 border-indigo-500" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => {
                setIsRegister(true);
                setError("");
                setSuccessMsg("");
              }}
              className={`flex-1 text-center py-2 text-sm font-semibold transition-colors ${
                isRegister ? "text-indigo-400 border-b-2 border-indigo-500" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Register Employee / Executive
            </button>
          </div>

          {error && (
            <div className="bg-rose-500/15 border border-rose-500/30 text-rose-300 px-4 py-3 rounded-xl text-xs font-semibold">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 px-4 py-3 rounded-xl text-xs font-semibold flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              {successMsg}
            </div>
          )}

          {!isRegister ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Username</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                    <User className="h-4 w-4" />
                  </span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none placeholder-slate-600 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Password</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                    <Lock className="h-4 w-4" />
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-10 py-3 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none placeholder-slate-600 font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-350"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl text-sm font-bold flex items-center justify-center transition-all shadow-lg hover:shadow-indigo-650/20 disabled:opacity-50"
              >
                {loading ? "Authenticating..." : (
                  <>
                    Access Dashboard <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Username *</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. rajesh1"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Email *</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. rajesh@nic.in"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Password *</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Full Name *</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Full legal name"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Age</label>
                  <input
                    type="number"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="Age"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Gender</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Social Category</label>
                  <select
                    value={socialCategory}
                    onChange={(e) => setSocialCategory(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                  >
                    <option value="General">General</option>
                    <option value="OBC">OBC</option>
                    <option value="SC">SC</option>
                    <option value="ST">ST</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Assign Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                  >
                    <option value="Manager">Manager (Dept / Project Lead)</option>
                    <option value="CEO">CEO (Chief Executive Officer)</option>
                    <option value="System Admin">System Admin (Administrator)</option>
                    <option value="Employee">Employee (Team Member)</option>
                  </select>
                </div>
              </div>

              <div className="border-t border-slate-800 pt-3">
                <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5 mb-2.5">
                  <MapPin className="h-3.5 w-3.5 text-indigo-400" /> Organization Jurisdiction
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={village}
                    onChange={(e) => setVillage(e.target.value)}
                    placeholder="Location / Office"
                    className="bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white outline-none font-medium"
                  />
                  <input
                    type="text"
                    value={block}
                    onChange={(e) => setBlock(e.target.value)}
                    placeholder="Department"
                    className="bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white outline-none font-medium"
                  />
                  <input
                    type="text"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    placeholder="City"
                    className="bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white outline-none font-medium"
                  />
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="Region / State"
                    className="bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white outline-none font-medium"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl text-sm font-bold flex items-center justify-center transition-all shadow-lg hover:shadow-emerald-650/20 disabled:opacity-50"
              >
                {loading ? "Registering..." : (
                  <>
                    Submit Registration & Login <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Demo Fast Login Buttons */}
        <div className="bg-slate-850 border border-slate-800/80 rounded-2xl p-6 space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase">
            <ShieldCheck className="h-4 w-4 text-indigo-400" /> Quick Role Logins (Enterprise Credentials)
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            Click one of the corporate seeded user credentials to login instantly with their respective role permissions.
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => handleQuickLogin("ceo")}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-[11px] font-bold text-white flex items-center justify-between"
            >
              <span>CEO (Executive)</span>
              <span className="text-[9px] text-indigo-400 bg-indigo-950 px-1.5 py-0.5 rounded font-mono">ceo</span>
            </button>
            <button
              onClick={() => handleQuickLogin("manager")}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-[11px] font-bold text-white flex items-center justify-between"
            >
              <span>Manager (Host)</span>
              <span className="text-[9px] text-emerald-400 bg-emerald-950 px-1.5 py-0.5 rounded font-mono">manager</span>
            </button>
            <button
              onClick={() => handleQuickLogin("employee1")}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-[11px] font-bold text-white flex items-center justify-between"
            >
              <span>Employee (Member)</span>
              <span className="text-[9px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded font-mono">employee1</span>
            </button>
            <button
              onClick={() => handleQuickLogin("admin")}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-[11px] font-bold text-white flex items-center justify-between"
            >
              <span>System Admin</span>
              <span className="text-[9px] text-amber-400 bg-amber-950 px-1.5 py-0.5 rounded font-mono">admin</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
