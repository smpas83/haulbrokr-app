import { memo, useCallback, useEffect, useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { PanelRight } from "lucide-react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { OfflineBanner } from "@/components/shared";
import { DispatcherTopBar } from "./DispatcherTopBar";
import { DispatcherSidebar } from "./DispatcherSidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface DispatcherLayoutProps {
  children: React.ReactNode;
  rightPanel: React.ReactNode;
  bottomDrawer: React.ReactNode;
  onlineDrivers: number;
  liveTrucks: number;
}

export const DispatcherLayout = memo(function DispatcherLayout({
  children,
  rightPanel,
  bottomDrawer,
  onlineDrivers,
  liveTrucks,
}: DispatcherLayoutProps) {
  const isMobile = useIsMobile();
  const [isTablet, setIsTablet] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false);

  useEffect(() => {
    const checkTablet = () => setIsTablet(window.innerWidth < 1024);
    checkTablet();
    window.addEventListener("resize", checkTablet);
    return () => window.removeEventListener("resize", checkTablet);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1280) {
        setSidebarCollapsed(true);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => !prev);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <DispatcherTopBar
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={toggleSidebar}
      />

      <OfflineBanner className="mx-4 mt-2 flex-shrink-0" />

      <div className="flex flex-1 overflow-hidden min-h-0">
        {!isMobile && (
          <DispatcherSidebar
            collapsed={sidebarCollapsed}
            onlineDrivers={onlineDrivers}
            liveTrucks={liveTrucks}
          />
        )}

        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {isMobile || isTablet ? (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 space-y-4">{children}</div>
              <div className="border-t border-border p-2 flex justify-end">
                <Sheet open={rightDrawerOpen} onOpenChange={setRightDrawerOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm" className="rounded-none border-2 font-bold">
                      <PanelRight className="h-4 w-4 mr-2" />
                      Operations Panel
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-full sm:max-w-md p-0 overflow-y-auto">
                    <div className="p-4 space-y-4">{rightPanel}</div>
                  </SheetContent>
                </Sheet>
              </div>
              {bottomDrawer}
            </div>
          ) : (
            <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
              <ResizablePanel defaultSize={65} minSize={45} className="min-h-0">
                <div className="h-full overflow-y-auto p-4 md:p-6 space-y-4">{children}</div>
              </ResizablePanel>
              <ResizableHandle withHandle aria-label="Resize operations panel" />
              <ResizablePanel defaultSize={35} minSize={20} maxSize={45} className="min-h-0">
                <div
                  className={cn(
                    "h-full overflow-y-auto p-4 space-y-4 border-l border-border",
                    "bg-card/30 backdrop-blur-sm"
                  )}
                  aria-label="Operations side panel"
                >
                  {rightPanel}
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          )}

          {!isMobile && !isTablet && bottomDrawer}
        </div>
      </div>
    </div>
  );
});
