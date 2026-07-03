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
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface CustomerLayoutProps {
  children: React.ReactNode;
  rightPanel: React.ReactNode;
  bottomDrawer: React.ReactNode;
  onRetry?: () => void;
}

export const CustomerLayout = memo(function CustomerLayout({
  children,
  rightPanel,
  bottomDrawer,
  onRetry,
}: CustomerLayoutProps) {
  const isMobile = useIsMobile();
  const [isTablet, setIsTablet] = useState(false);
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false);

  useEffect(() => {
    const checkTablet = () => setIsTablet(window.innerWidth < 1024);
    checkTablet();
    window.addEventListener("resize", checkTablet);
    return () => window.removeEventListener("resize", checkTablet);
  }, []);

  const closeDrawer = useCallback(() => setRightDrawerOpen(false), []);

  return (
    <div className="flex flex-col min-h-0 -mb-4 md:-mb-8">
      <OfflineBanner className="mb-4 flex-shrink-0" onRetry={onRetry} />

      {isMobile || isTablet ? (
        <div className="flex flex-col min-h-0">
          <div className="space-y-4">{children}</div>
          <div className="sticky bottom-16 md:bottom-0 border-t border-border p-2 flex justify-end bg-background/95 backdrop-blur-sm z-10 mt-4">
            <Sheet open={rightDrawerOpen} onOpenChange={setRightDrawerOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="rounded-none border-2 font-bold">
                  <PanelRight className="h-4 w-4 mr-2" aria-hidden="true" />
                  Operations Panel
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[75vh] p-0 overflow-y-auto rounded-none">
                <div className="p-4 space-y-4" onClick={closeDrawer}>{rightPanel}</div>
              </SheetContent>
            </Sheet>
          </div>
          {bottomDrawer}
        </div>
      ) : (
        <div className="flex flex-col min-h-0 flex-1">
          <ResizablePanelGroup direction="horizontal" className="min-h-[600px] rounded-none">
            <ResizablePanel defaultSize={65} minSize={45} className="min-h-0">
              <div className="h-full overflow-y-auto space-y-4 pr-2">{children}</div>
            </ResizablePanel>
            <ResizableHandle withHandle aria-label="Resize operations panel" />
            <ResizablePanel defaultSize={35} minSize={25} maxSize={45} className="min-h-0">
              <aside
                className={cn(
                  "h-full overflow-y-auto space-y-4 pl-2 border-l border-border",
                  "bg-card/30 backdrop-blur-sm"
                )}
                aria-label="Operations side panel"
              >
                {rightPanel}
              </aside>
            </ResizablePanel>
          </ResizablePanelGroup>
          {bottomDrawer}
        </div>
      )}
    </div>
  );
});
