import { useState } from "react";
import { useLocation } from "wouter";
import { Loader2, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const STAFF_ROLES = [
  { username: "ceo", label: "CEO" },
  { username: "president", label: "President" },
  { username: "cto", label: "CTO" },
  { username: "cfo", label: "CFO" },
  { username: "accounting", label: "Accounting" },
  { username: "it", label: "IT" },
  { username: "programmer", label: "Programmer" },
];

export default function AdminLoginPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Login failed");
      }
      toast({
        title: "Signed in",
        description: `Welcome, ${body.displayName ?? username}.`,
      });
      navigate("/admin");
    } catch (err) {
      toast({
        title: "Could not sign in",
        description: err instanceof Error ? err.message : "Check your username and password.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-6">
      <Card className="w-full max-w-md rounded-none border-2">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <CardTitle className="text-xl font-bold">Staff Command Center</CardTitle>
          </div>
          <CardDescription>
            HaulBrokr internal admin login. Use your staff username and password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                className="rounded-none border-2"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. ceo, cfo, it"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                className="rounded-none border-2"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full rounded-none" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
              Sign in
            </Button>
          </form>
          <div className="mt-6 border-t pt-4">
            <p className="text-xs text-muted-foreground mb-2 font-semibold uppercase tracking-wide">Staff roles</p>
            <div className="flex flex-wrap gap-1">
              {STAFF_ROLES.map((r) => (
                <button
                  key={r.username}
                  type="button"
                  className="text-xs px-2 py-1 border border-border rounded-none hover:bg-muted"
                  onClick={() => setUsername(r.username)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
