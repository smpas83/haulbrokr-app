import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMyProfile } from "@/hooks/useLiveApi";
import { useAuth } from "@clerk/expo";

export type Role = "customer" | "provider" | "driver" | "supervisor";
export type JobStatus = "open" | "bidding" | "accepted" | "in_progress" | "completed" | "cancelled";
export type ProjectType = "Transport" | "Material & Transport" | "Tracking" | "Recycling";

export interface UserProfile {
  name: string; company: string; phone: string;
  city: string; state: string; role: Role;
  rating: number; totalHauls: number; memberSince: string;
  orgName?: string; orgInviteCode?: string;
}

export interface TeamMember {
  id: string; name: string; role: Role;
  phone?: string; joinedAt: string; active: boolean;
}

export interface Bid {
  id: string; jobId: string; providerName: string; company: string;
  ratePerHour: number; trucksAvailable: number; canStartImmediately: boolean;
  message: string; submittedAt: string;
}

export interface Message {
  id: string; from: "customer" | "provider";
  senderName: string; text: string; time: string;
}

export type TicketStatus = "pending" | "in_progress" | "completed" | "verified";

export interface LoadTicket {
  id: string; loadNumber: number; timestamp: string;
  weight?: string; notes?: string; hasPhoto: boolean;
  status?: TicketStatus;
  clockedInAt?: string; clockedOutAt?: string;
  qrToken?: string;
  verifiedAt?: string; verifiedBy?: string;
  pendingSync?: boolean;
}

export interface Job {
  id: string; projectName: string; projectType: ProjectType;
  material: string; quantity: number; quantityUnit: string;
  pickupAddress: string; deliveryAddress: string;
  budgetPerHour: number; preferredRate: number; status: JobStatus;
  trucksNeeded: number; scheduledDate: string; endDate: string;
  postedAt: string; postedBy: string; bidsCount: number;
  providerSupplies: boolean; distanceToStart: number; distanceToEnd: number;
  notes?: string; bids: Bid[];
  providerPhone?: string; providerCompany?: string;
  checkInTime?: string; checkOutTime?: string;
  cancellationReason?: string; messages?: Message[];
  myRating?: number; loadTickets?: LoadTicket[];
  disputeReason?: string;
}

export interface ActivityItem {
  id: string; icon: string; text: string; time: string;
  type: "bid" | "job" | "bin" | "payment" | "alert";
}

export interface Transaction {
  id: string; type: "credit" | "debit"; amount: number;
  description: string; date: string;
  status: "completed" | "pending"; paymentMethod?: string;
}

export interface Notification {
  id: string; title: string; body: string; time: string;
  type: "bid" | "job" | "payment" | "alert" | "tracking";
  read: boolean; jobId?: string;
}

export interface FleetTruck {
  id: string; driverName: string; truckType: string;
  truckNumber: string; status: "active" | "idle" | "offline";
  currentJobId?: string; todayLoads: number; todayTons: number;
  location: string; phone: string;
}

interface AppContextType {
  profile: UserProfile; setProfile: (p: UserProfile) => void;
  isOnline: boolean; setIsOnline: (v: boolean) => void;
  userLocation: string; setUserLocation: (v: string) => void;
  searchRadius: number; setSearchRadius: (v: number) => void;
  jobs: Job[];
  addJob: (j: Omit<Job, "id" | "postedAt" | "bidsCount" | "bids">) => void;
  placeBid: (jobId: string, bid: Omit<Bid, "id" | "jobId" | "submittedAt">) => void;
  acceptBid: (jobId: string, bidId: string) => void;
  updateJobStatus: (jobId: string, status: JobStatus) => void;
  checkIn: (jobId: string) => void; checkOut: (jobId: string) => void;
  cancelJob: (jobId: string, reason: string) => void;
  sendMessage: (jobId: string, msg: Omit<Message, "id">) => void;
  rateJob: (jobId: string, rating: number) => void;
  addLoadTicket: (jobId: string, ticket: Omit<LoadTicket, "id">) => string;
  ticketClockIn: (jobId: string, ticketId: string) => void;
  ticketClockOut: (jobId: string, ticketId: string) => void;
  generateTicketQR: (jobId: string, ticketId: string) => string;
  verifyTicketByToken: (qrToken: string, verifierName: string) => { ok: boolean; jobId?: string; ticketId?: string; loadNumber?: number; error?: string };
  fileDispute: (jobId: string, reason: string) => void;
  activity: ActivityItem[];
  stats: { activeJobs: number; openRequests: number; revenue: string; pendingBids: number; earnings: string; toBeReleased: string };
  walletBalance: number; setWalletBalance: (v: number) => void;
  transactions: Transaction[]; addTransaction: (t: Omit<Transaction, "id">) => void;
  notifications: Notification[]; markNotificationRead: (id: string) => void; markAllRead: () => void;
  fleet: FleetTruck[]; updateTruckStatus: (id: string, status: FleetTruck["status"]) => void;
  team: TeamMember[];
  addTeamMember: (m: Omit<TeamMember, "id" | "joinedAt">) => void;
  removeTeamMember: (id: string) => void;
  rotateInviteCode: () => void;
}

const EMPTY_STATS = {
  activeJobs: 0, openRequests: 0, revenue: "$0",
  pendingBids: 0, earnings: "$0", toBeReleased: "$0",
};

const AppContext = createContext<AppContextType>({} as AppContextType);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile>({
    name: "", company: "",
    phone: "", city: "", state: "",
    role: "customer", rating: 0, totalHauls: 0, memberSince: "",
  });
  const liveProfile = useMyProfile();
  const { isSignedIn } = useAuth();
  const [isOnline, setIsOnline] = useState(false);
  const [userLocation, setUserLocationState] = useState("");
  const [searchRadius, setSearchRadiusState] = useState(25);

  useEffect(() => {
    if (!isSignedIn) {
      setProfile({
        name: "", company: "",
        phone: "", city: "", state: "",
        role: "customer", rating: 0, totalHauls: 0, memberSince: "",
      });
    }
  }, [isSignedIn]);

  useEffect(() => {
    const p = liveProfile.data as any;
    if (!p) return;
    const created = p.createdAt ? new Date(p.createdAt) : null;
    setProfile((prev) => ({
      ...prev,
      name: p.contactName || p.companyName || "",
      company: p.companyName || "",
      phone: p.phone || "",
      city: p.city || "",
      state: p.state || "",
      role: (p.role as Role) || "customer",
      memberSince: created
        ? created.toLocaleDateString("en-US", { month: "short", year: "numeric" })
        : "",
      orgName: p.companyName || "",
    }));
  }, [liveProfile.data]);

  useEffect(() => {
    AsyncStorage.multiGet(["userLocation", "searchRadius"]).then((pairs) => {
      const loc = pairs[0][1]; const rad = pairs[1][1];
      if (loc) setUserLocationState(loc);
      if (rad) setSearchRadiusState(Number(rad));
    });
  }, []);

  const setUserLocation = (v: string) => {
    setUserLocationState(v);
    AsyncStorage.setItem("userLocation", v);
  };
  const setSearchRadius = (v: number) => {
    setSearchRadiusState(v);
    AsyncStorage.setItem("searchRadius", String(v));
  };
  const [jobs, setJobs] = useState<Job[]>([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activity] = useState<ActivityItem[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [fleet, setFleet] = useState<FleetTruck[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);

  const addTeamMember = (m: Omit<TeamMember, "id" | "joinedAt">) => {
    const joinedAt = new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
    setTeam((prev) => [{ ...m, id: `tm${Date.now()}`, joinedAt }, ...prev]);
  };
  const removeTeamMember = (id: string) => setTeam((prev) => prev.filter((t) => t.id !== id));
  const rotateInviteCode = () => {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "DB-";
    for (let i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
    setProfile({ ...profile, orgInviteCode: code });
  };

  const addJob = (j: Omit<Job, "id" | "postedAt" | "bidsCount" | "bids">) => {
    const newJob: Job = { ...j, id: Date.now().toString(), postedAt: new Date().toISOString().split("T")[0], bidsCount: 0, bids: [] };
    setJobs((prev) => [newJob, ...prev]);
  };

  const placeBid = (jobId: string, bid: Omit<Bid, "id" | "jobId" | "submittedAt">) => {
    const newBid: Bid = { ...bid, id: Date.now().toString(), jobId, submittedAt: new Date().toISOString().split("T")[0] };
    setJobs((prev) => prev.map((j) => j.id === jobId ? { ...j, bidsCount: j.bidsCount + 1, bids: [...j.bids, newBid], status: "bidding" } : j));
  };

  const acceptBid = (jobId: string, bidId: string) => {
    setJobs((prev) => prev.map((j) => {
      if (j.id !== jobId) return j;
      if (j.status !== "open" && j.status !== "bidding") return j;
      const winner = j.bids.find((b) => b.id === bidId);
      if (!winner) return j;
      return {
        ...j,
        status: "accepted",
        providerCompany: winner.company,
        providerPhone: j.providerPhone ?? "(214) 555-0100",
      };
    }));
  };

  const updateJobStatus = (jobId: string, status: JobStatus) =>
    setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, status } : j)));

  const checkIn = (jobId: string) => {
    const time = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, checkInTime: time } : j)));
  };

  const checkOut = (jobId: string) => {
    const time = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, checkOutTime: time } : j)));
  };

  const cancelJob = (jobId: string, reason: string) =>
    setJobs((prev) => prev.map((j) => j.id === jobId ? { ...j, status: "cancelled", cancellationReason: reason } : j));

  const sendMessage = (jobId: string, msg: Omit<Message, "id">) => {
    const newMsg: Message = { ...msg, id: Date.now().toString() };
    setJobs((prev) => prev.map((j) => j.id === jobId ? { ...j, messages: [...(j.messages ?? []), newMsg] } : j));
  };

  const rateJob = (jobId: string, rating: number) =>
    setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, myRating: rating } : j)));

  const addLoadTicket = (jobId: string, ticket: Omit<LoadTicket, "id">) => {
    const id = Date.now().toString();
    const newTicket: LoadTicket = { ...ticket, id, status: ticket.status ?? "pending" };
    setJobs((prev) => prev.map((j) => j.id === jobId ? { ...j, loadTickets: [...(j.loadTickets ?? []), newTicket] } : j));
    return id;
  };

  const ticketClockIn = (jobId: string, ticketId: string) => {
    const time = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    setJobs((prev) => prev.map((j) => j.id !== jobId ? j : {
      ...j,
      loadTickets: (j.loadTickets ?? []).map((t) => t.id === ticketId
        ? { ...t, clockedInAt: time, status: "in_progress" as TicketStatus }
        : t),
    }));
  };

  const ticketClockOut = (jobId: string, ticketId: string) => {
    const time = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    setJobs((prev) => prev.map((j) => j.id !== jobId ? j : {
      ...j,
      loadTickets: (j.loadTickets ?? []).map((t) => t.id === ticketId
        ? { ...t, clockedOutAt: time, status: "completed" as TicketStatus }
        : t),
    }));
  };

  const generateTicketQR = (jobId: string, ticketId: string): string => {
    const token = `db:${jobId}:${ticketId}:${Date.now().toString(36)}`;
    setJobs((prev) => prev.map((j) => j.id !== jobId ? j : {
      ...j,
      loadTickets: (j.loadTickets ?? []).map((t) => t.id === ticketId ? { ...t, qrToken: token } : t),
    }));
    return token;
  };

  const verifyTicketByToken = (qrToken: string, verifierName: string) => {
    // Parse token: db:<jobId>:<ticketId>:<nonce>
    const parts = qrToken.trim().split(":");
    if (parts.length < 3 || parts[0] !== "db") {
      return { ok: false, error: "Not a HaulBrokr ticket QR code." };
    }
    const [, jobId, ticketId] = parts;
    const job = jobs.find((j) => j.id === jobId);
    const ticket = job?.loadTickets?.find((t) => t.id === ticketId);
    if (!job || !ticket) {
      return { ok: false, error: "Ticket not found. It may belong to another company." };
    }
    if (ticket.verifiedAt) {
      return { ok: false, error: `Ticket #${ticket.loadNumber} was already verified at ${ticket.verifiedAt}.` };
    }
    const time = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    setJobs((prev) => prev.map((j) => j.id !== jobId ? j : {
      ...j,
      loadTickets: (j.loadTickets ?? []).map((t) => t.id === ticketId
        ? { ...t, status: "verified" as TicketStatus, verifiedAt: time, verifiedBy: verifierName }
        : t),
    }));
    return { ok: true, jobId, ticketId, loadNumber: ticket.loadNumber };
  };

  const fileDispute = (jobId: string, reason: string) =>
    setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, disputeReason: reason } : j)));


  const addTransaction = (t: Omit<Transaction, "id">) =>
    setTransactions((prev) => [{ ...t, id: Date.now().toString() }, ...prev]);

  const markNotificationRead = (id: string) =>
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));

  const markAllRead = () =>
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

  const updateTruckStatus = (id: string, status: FleetTruck["status"]) =>
    setFleet((prev) => prev.map((t) => t.id === id ? { ...t, status } : t));

  return (
    <AppContext.Provider value={{
      profile, setProfile, isOnline, setIsOnline,
      userLocation, setUserLocation, searchRadius, setSearchRadius,
      jobs, addJob, placeBid, acceptBid, updateJobStatus, checkIn, checkOut,
      cancelJob, sendMessage, rateJob, addLoadTicket, fileDispute,
      ticketClockIn, ticketClockOut, generateTicketQR, verifyTicketByToken,
      activity, stats: EMPTY_STATS,
      walletBalance, setWalletBalance, transactions, addTransaction,
      notifications, markNotificationRead, markAllRead,
      fleet, updateTruckStatus,
      team, addTeamMember, removeTeamMember, rotateInviteCode,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() { return useContext(AppContext); }
