import { useLocation, useParams } from "wouter";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  ArrowLeft, MapPin, Calendar, Truck, HardHat, FileText, 
  DollarSign, Clock, ShieldCheck, Loader2 
} from "lucide-react";
import { 
  useGetRequest, useListBids, useCreateBid, useUpdateBid, 
  useGetMyProfile, getGetRequestQueryKey, getListBidsQueryKey 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

const bidSchema = z.object({
  ratePerHour: z.coerce.number().positive("Rate must be positive."),
  trucksOffered: z.coerce.number().int().positive("Must offer at least 1 truck."),
  estimatedHours: z.coerce.number().positive().optional().or(z.literal("")),
  message: z.string().optional(),
});

export default function RequestDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: profile } = useGetMyProfile();
  const { data: request, isLoading: requestLoading } = useGetRequest(id, {
    query: { enabled: !!id } as any
  });
  const { data: bids, isLoading: bidsLoading } = useListBids(id, {
    query: { enabled: !!id } as any
  });

  const createBid = useCreateBid();
  const updateBid = useUpdateBid();

  const isCustomer = profile?.role === "customer";
  const isProvider = profile?.role === "provider";
  
  // A provider has already bid if they have a bid in the list
  const existingBid = bids?.find(b => b.providerId === profile?.id);
  const requestOpenForBids = request?.status === "open" || request?.status === "bid_received" || request?.status === "bidding";
  const canBid = isProvider && requestOpenForBids && !existingBid;

  const form = useForm<z.infer<typeof bidSchema>>({
    resolver: zodResolver(bidSchema),
    defaultValues: {
      ratePerHour: "" as any,
      trucksOffered: 1,
      estimatedHours: "" as any,
      message: "",
    },
  });

  const onBidSubmit = (values: z.infer<typeof bidSchema>) => {
    createBid.mutate(
      { 
        requestId: id,
        data: {
          ratePerHour: Number(values.ratePerHour),
          trucksOffered: Number(values.trucksOffered),
          estimatedHours: values.estimatedHours ? Number(values.estimatedHours) : undefined,
          message: values.message
        } 
      },
      {
        onSuccess: () => {
          toast({ title: "Bid submitted successfully" });
          queryClient.invalidateQueries({ queryKey: getListBidsQueryKey(id) });
          queryClient.invalidateQueries({ queryKey: getGetRequestQueryKey(id) });
          // Dialog will close automatically if we control open state, but for now we let it reload
        },
        onError: (err) => {
          toast({ 
            title: "Failed to submit bid", 
            description: err instanceof Error ? err.message : "Unknown error",
            variant: "destructive"
          });
        }
      }
    );
  };

  const handleAwardBid = (bidId: number) => {
    updateBid.mutate(
      { id: bidId, data: { status: "accepted" } },
      {
        onSuccess: () => {
          toast({ title: "Bid awarded. Awaiting hauler acceptance." });
          queryClient.invalidateQueries({ queryKey: getGetRequestQueryKey(id) });
          queryClient.invalidateQueries({ queryKey: getListBidsQueryKey(id) });
        },
        onError: (err) => {
          toast({
            title: "Failed to award bid",
            description: err instanceof Error ? err.message : "Unknown error",
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleRejectBid = (bidId: number) => {
    updateBid.mutate(
      { id: bidId, data: { status: "rejected" } },
      {
        onSuccess: () => {
          toast({ title: "Bid rejected." });
          queryClient.invalidateQueries({ queryKey: getListBidsQueryKey(id) });
        }
      }
    );
  };

  if (requestLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid md:grid-cols-3 gap-6">
          <Skeleton className="h-[400px] md:col-span-2" />
          <Skeleton className="h-[400px] md:col-span-1" />
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="max-w-6xl mx-auto text-center py-20">
        <h2 className="text-2xl font-bold">Request not found</h2>
        <Button className="mt-4" onClick={() => setLocation("/requests")}>Back to Requests</Button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500 pb-12">
      <Button variant="ghost" className="mb-2 -ml-4" onClick={() => setLocation("/requests")}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold tracking-tight uppercase">
              JOB-{request.id.toString().padStart(4, '0')}
            </h1>
            <Badge variant="outline" className="border-2 font-bold uppercase text-xs px-3 py-1">
              {request.status.replace('_', ' ')}
            </Badge>
          </div>
          <p className="text-xl font-medium text-muted-foreground">
            {request.quantityTons} Tons of <span className="capitalize">{request.materialType}</span>
          </p>
        </div>

        {canBid && (
          <Dialog>
            <DialogTrigger asChild>
              <Button size="lg" className="font-bold rounded-none h-12 px-8 shadow-md border-2 border-transparent hover:border-foreground" data-testid="btn-place-bid">
                Place a Bid
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] border-2 rounded-none p-0">
              <div className="bg-primary/10 border-b-2 border-border p-6">
                <DialogTitle className="text-2xl font-bold">Submit Bid</DialogTitle>
                <DialogDescription className="text-foreground/80 mt-2 font-medium">
                  You are bidding on {request.quantityTons} tons of {request.materialType} for {request.customerCompany}.
                </DialogDescription>
              </div>
              <div className="p-6">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onBidSubmit)} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="ratePerHour"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Rate ($/Hour)</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="125" {...field} className="h-12 border-2 rounded-none font-bold text-lg" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="trucksOffered"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Trucks Offered</FormLabel>
                            <FormControl>
                              <Input type="number" min="1" {...field} className="h-12 border-2 rounded-none" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="estimatedHours"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Est. Total Hours (Optional)</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="e.g. 8" {...field} className="h-12 border-2 rounded-none" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="message"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Message (Optional)</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Any terms or notes for the customer..." className="border-2 rounded-none resize-none" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full h-12 font-bold rounded-none" disabled={createBid.isPending}>
                      {createBid.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Submit Bid
                    </Button>
                  </form>
                </Form>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Main Details */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-card border-2 border-border p-6 shadow-sm">
            <h2 className="text-lg font-bold flex items-center gap-2 mb-6 border-b-2 border-border pb-2">
              <FileText className="h-5 w-5 text-primary" />
              Job Specifications
            </h2>
            
            <div className="grid sm:grid-cols-2 gap-y-6 gap-x-12">
              <div>
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">Customer</p>
                <p className="font-medium flex items-center gap-2">
                  <HardHat className="h-4 w-4 text-primary" />
                  {request.customerCompany}
                </p>
              </div>
              
              <div>
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">Scheduled Date</p>
                <p className="font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  {format(new Date(request.scheduledDate), "EEEE, MMMM d, yyyy")}
                </p>
              </div>
              
              <div>
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">Trucks Needed</p>
                <p className="font-medium flex items-center gap-2">
                  <Truck className="h-4 w-4 text-primary" />
                  {request.trucksNeeded} Truck{request.trucksNeeded > 1 ? 's' : ''}
                </p>
              </div>
              
              <div>
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">Target Budget</p>
                <p className="font-medium flex items-center gap-2 text-lg">
                  <DollarSign className="h-5 w-5 text-primary" />
                  {request.budgetPerHour ? `$${request.budgetPerHour} / hour` : 'Open to Bids'}
                </p>
              </div>
            </div>

            <div className="mt-8 grid sm:grid-cols-2 gap-8">
              <div className="bg-muted/50 p-4 border border-border">
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" /> Pickup Location
                </p>
                <p className="font-medium whitespace-pre-line">{request.pickupAddress}</p>
              </div>
              <div className="bg-muted/50 p-4 border border-border">
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" /> Delivery Location
                </p>
                <p className="font-medium whitespace-pre-line">{request.deliveryAddress}</p>
              </div>
            </div>

            {request.notes && (
              <div className="mt-8 border-t-2 border-border pt-6">
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Special Instructions</p>
                <p className="text-foreground/90 whitespace-pre-line bg-yellow-50 dark:bg-yellow-900/20 p-4 border-l-4 border-yellow-400">
                  {request.notes}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Bids Sidebar */}
        <div className="space-y-6">
          <div className="bg-card border-2 border-border shadow-sm flex flex-col h-full max-h-[800px]">
            <div className="p-4 border-b-2 border-border bg-muted/30">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Bids ({bids?.length || 0})
              </h2>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/10">
              {bidsLoading ? (
                Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-none" />)
              ) : bids && bids.length > 0 ? (
                bids.map((bid) => (
                  <div key={bid.id} className={`border-2 p-4 bg-card ${bid.status === 'awarded' || bid.status === 'accepted' ? 'border-primary shadow-md' : 'border-border'}`}>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-bold text-lg">{bid.providerCompany}</p>
                        <p className="text-sm text-muted-foreground">{format(new Date(bid.createdAt), "MMM d, h:mm a")}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-xl">${bid.ratePerHour}<span className="text-sm text-muted-foreground font-medium">/hr</span></p>
                        <Badge variant="outline" className={`rounded-none mt-1 uppercase text-[10px] font-bold ${
                          bid.status === 'awarded' || bid.status === 'accepted' ? 'bg-primary/20 text-primary border-primary' : 
                          bid.status === 'rejected' ? 'bg-destructive/10 text-destructive border-destructive/20' : 
                          'bg-secondary text-secondary-foreground border-secondary-foreground/20'
                        }`}>
                          {bid.status}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="flex gap-4 text-sm font-medium mb-3 bg-muted/50 p-2">
                      <div className="flex items-center gap-1.5"><Truck className="h-4 w-4" /> {bid.trucksOffered}</div>
                      {bid.estimatedHours && (
                        <div className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> ~{bid.estimatedHours}h</div>
                      )}
                    </div>
                    
                    {bid.message && (
                      <p className="text-sm text-muted-foreground italic mb-4">"{bid.message}"</p>
                    )}
                    
                    {isCustomer && requestOpenForBids && bid.status === "pending" && (
                      <div className="flex gap-2 pt-3 border-t border-border">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="flex-1 rounded-none border-2 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                          onClick={() => handleRejectBid(bid.id)}
                          disabled={updateBid.isPending}
                        >
                          Decline
                        </Button>
                        <Button 
                          size="sm" 
                          className="flex-1 rounded-none font-bold"
                          onClick={() => handleAwardBid(bid.id)}
                          disabled={updateBid.isPending}
                          data-testid={`btn-award-bid-${bid.id}`}
                        >
                          Award Bid
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-10">
                  <p className="text-muted-foreground font-medium">No bids placed yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}