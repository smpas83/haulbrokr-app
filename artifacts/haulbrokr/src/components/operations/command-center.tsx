import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput,
  CommandItem, CommandList, CommandSeparator, CommandShortcut,
} from "@/components/ui/command";
import { apiFetch } from "@/lib/apiFetch";
import {
  LayoutDashboard, ClipboardList, Briefcase, Radio, MapPin,
  Settings, Sparkles, Truck, Search, Layers, Plus, FileText,
} from "lucide-react";

interface SearchResult {
  type: string;
  label: string;
  href: string;
  subtitle?: string;
}

interface CommandCenterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCopilotOpen: () => void;
}

const QUICK_COMMANDS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, shortcut: "D" },
  { label: "Enterprise OS", href: "/enterprise", icon: Layers, shortcut: "E" },
  { label: "Load Board", href: "/requests", icon: ClipboardList, shortcut: "L" },
  { label: "Active Jobs", href: "/jobs", icon: Briefcase, shortcut: "J" },
  { label: "Digital Twin", href: "/dispatch", icon: Radio, shortcut: "T" },
  { label: "Live Map", href: "/map", icon: MapPin, shortcut: "M" },
  { label: "My Fleet", href: "/fleet", icon: Truck, shortcut: "F" },
  { label: "Account", href: "/account", icon: Settings, shortcut: "A" },
  { label: "New Request", href: "/requests/new", icon: Plus, shortcut: "N" },
  { label: "Documents", href: "/enterprise?tab=documents", icon: FileText, shortcut: "" },
];

export function CommandCenter({ open, onOpenChange, onCopilotOpen }: CommandCenterProps) {
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const [opsData, enterpriseData] = await Promise.all([
        apiFetch<{ results: SearchResult[] }>(`/operations/search?q=${encodeURIComponent(q)}`).catch(() => ({ results: [] })),
        apiFetch<{ results: SearchResult[] }>(`/enterprise/search?q=${encodeURIComponent(q)}`).catch(() => ({ results: [] })),
      ]);
      const merged = [...(enterpriseData.results ?? []), ...(opsData.results ?? [])];
      const seen = new Set<string>();
      setResults(merged.filter((r) => {
        const key = `${r.type}-${r.href}-${r.label}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }));
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => runSearch(query), 200);
    return () => clearTimeout(t);
  }, [query, runSearch]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const go = (href: string) => {
    onOpenChange(false);
    if (href === "#copilot") {
      onCopilotOpen();
    } else {
      navigate(href);
    }
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search everything — loads, docs, customers, reports…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>{searching ? "Searching…" : "No results found."}</CommandEmpty>

        {results.length > 0 && (
          <CommandGroup heading="Search Results">
            {results.map((r) => (
              <CommandItem key={`${r.type}-${r.label}`} onSelect={() => go(r.href)}>
                <Search className="mr-2 h-4 w-4" />
                <span>{r.label}</span>
                {r.subtitle && <span className="ml-2 text-xs text-muted-foreground">{r.subtitle}</span>}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandSeparator />

        <CommandGroup heading="Quick Commands">
          {QUICK_COMMANDS.map((cmd) => (
            <CommandItem key={cmd.href} onSelect={() => go(cmd.href)}>
              <cmd.icon className="mr-2 h-4 w-4" />
              <span>{cmd.label}</span>
              <CommandShortcut>⌘{cmd.shortcut}</CommandShortcut>
            </CommandItem>
          ))}
          <CommandItem onSelect={() => go("#copilot")}>
            <Sparkles className="mr-2 h-4 w-4" />
            <span>AI Copilot</span>
            <CommandShortcut>⌘I</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Natural Language">
          <CommandItem onSelect={() => { onOpenChange(false); onCopilotOpen(); }}>
            <Sparkles className="mr-2 h-4 w-4" />
            <span>Ask AI: &quot;{query || "Summarize my active jobs"}&quot;</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

export function useCommandCenter(onCopilotOpen: () => void, navigate: (path: string) => void) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "i") {
        e.preventDefault();
        onCopilotOpen();
      }
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey) {
        const shortcuts: Record<string, string> = {
          d: "/dashboard",
          e: "/enterprise",
          l: "/requests",
          j: "/jobs",
          t: "/dispatch",
          m: "/map",
          f: "/fleet",
          a: "/account",
          n: "/requests/new",
        };
        const href = shortcuts[e.key.toLowerCase()];
        if (href && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
          e.preventDefault();
          navigate(href);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCopilotOpen, navigate]);

  return { open, setOpen };
}
