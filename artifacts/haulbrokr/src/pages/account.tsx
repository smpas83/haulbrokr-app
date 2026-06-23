import React, { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useMutation, useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { 
  Loader2, CheckCircle2, AlertCircle, Clock, ShieldAlert,
  CreditCard, Banknote, HelpCircle, ShieldCheck, FileText
} from "lucide-react";
import {
  useGetMyProfile, useUpdateMyProfile, getGetMyProfileQueryKey,
  useGetAccountStatus, getGetAccountStatusQueryKey,
  useGetW9, useSubmitW9, useUpdateW9, getGetW9QueryKey,
  useGetInsurance, useSubmitInsurance, useUpdateInsurance, getGetInsuranceQueryKey,
  useGetPaymentMethod, useSetPaymentMethod, useUpdatePaymentMethod, getGetPaymentMethodQueryKey,
  useGetPayoutAccount, useSetPayoutAccount, useUpdatePayoutAccount, getGetPayoutAccountQueryKey,
  useGetPayoutStatus, getGetPayoutStatusQueryKey, useConnectPayoutLink,
  useGetCompliance, useSubmitCompliance, useVerifyCompliance, getGetComplianceQueryKey,
  useGetCreditApplication, useSubmitCreditApplication, getGetCreditApplicationQueryKey
} from "@workspace/api-client-react";

import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { StripeCardForm } from "@/components/stripe-card-form";
import { StripeBankForm } from "@/components/stripe-bank-form";
import { MicrodepositVerify } from "@/components/microdeposit-verify";

function StatusBadge({ status, text }: { status: "not_submitted"|"not_set"|"pending"|"verified"|"rejected", text?: string }) {
  if (status === "verified") {
    return <Badge className="bg-green-500 hover:bg-green-600 rounded-none"><CheckCircle2 className="w-3 h-3 mr-1"/> {text || "Verified"}</Badge>;
  }
  if (status === "pending") {
    return <Badge className="bg-amber-500 hover:bg-amber-600 text-amber-950 rounded-none"><Clock className="w-3 h-3 mr-1"/> {text || "Pending Review"}</Badge>;
  }
  if (status === "rejected") {
    return <Badge variant="destructive" className="rounded-none"><AlertCircle className="w-3 h-3 mr-1"/> {text || "Rejected"}</Badge>;
  }
  return <Badge variant="secondary" className="rounded-none text-muted-foreground">{text || "Not Submitted"}</Badge>;
}

const profileSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  contactName: z.string().min(1, "Contact name is required"),
  phone: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
});

function ProfileTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useGetMyProfile();
  const updateProfile = useUpdateMyProfile();

  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      companyName: "",
      contactName: "",
      phone: "",
      city: "",
      state: "",
    },
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        companyName: profile.companyName || "",
        contactName: profile.contactName || "",
        phone: profile.phone || "",
        city: profile.city || "",
        state: profile.state || "",
      });
    }
  }, [profile, form]);

  if (isLoading) return <Skeleton className="h-[400px] w-full" />;

  function onSubmit(values: z.infer<typeof profileSchema>) {
    updateProfile.mutate({ data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
        toast({ title: "Profile updated successfully" });
      },
      onError: () => toast({ title: "Failed to update profile", variant: "destructive" })
    });
  }

  return (
    <Card className="rounded-none border-2">
      <CardHeader>
        <CardTitle>Company Profile</CardTitle>
        <CardDescription>Basic information about your business</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Name</FormLabel>
                    <FormControl><Input {...field} className="rounded-none" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contactName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Primary Contact</FormLabel>
                    <FormControl><Input {...field} className="rounded-none" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl><Input type="tel" {...field} className="rounded-none" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl><Input {...field} className="rounded-none" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>State</FormLabel>
                    <FormControl><Input {...field} className="rounded-none" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <Button type="submit" disabled={updateProfile.isPending} className="rounded-none font-bold">
              {updateProfile.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Profile
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

const w9Schema = z.object({
  legalName: z.string().min(1, "Legal name is required"),
  businessName: z.string().optional(),
  businessType: z.enum(["sole_proprietor", "single_member_llc", "multi_member_llc", "partnership", "c_corporation", "s_corporation", "other"]),
  taxIdType: z.enum(["ein", "ssn"]),
  taxIdLast4: z.string().length(4, "Must be exactly 4 digits"),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zip: z.string().min(1, "ZIP code is required"),
  signatureFullName: z.string().min(1, "Signature is required"),
  agreedToTerms: z.literal("true"),
});

function W9Tab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: w9, isLoading, error } = useGetW9();
  const submitW9 = useSubmitW9();
  const updateW9 = useUpdateW9();

  const isNotFound = error && (error as any).status === 404;
  const isExisting = !!w9 && !isNotFound;

  const form = useForm<z.infer<typeof w9Schema>>({
    resolver: zodResolver(w9Schema),
    defaultValues: {
      legalName: "",
      businessName: "",
      businessType: "sole_proprietor",
      taxIdType: "ein",
      taxIdLast4: "",
      address: "",
      city: "",
      state: "",
      zip: "",
      signatureFullName: "",
      agreedToTerms: "true" as any,
    },
  });

  useEffect(() => {
    if (w9) {
      form.reset({
        legalName: w9.legalName || "",
        businessName: w9.businessName || "",
        businessType: (w9.businessType as any) || "sole_proprietor",
        taxIdType: (w9.taxIdType as any) || "ein",
        taxIdLast4: w9.taxIdLast4 || "",
        address: w9.address || "",
        city: w9.city || "",
        state: w9.state || "",
        zip: w9.zip || "",
        signatureFullName: w9.signatureFullName || "",
        agreedToTerms: w9.agreedToTerms ? "true" : ("false" as any),
      });
    }
  }, [w9, form]);

  if (isLoading) return <Skeleton className="h-[400px] w-full" />;

  function onSubmit(values: z.infer<typeof w9Schema>) {
    const action = isExisting ? updateW9.mutate : submitW9.mutate;
    action({ data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetW9QueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAccountStatusQueryKey() });
        toast({ title: isExisting ? "W-9 updated successfully" : "W-9 submitted successfully" });
      },
      onError: () => toast({ title: "Failed to save W-9", variant: "destructive" })
    });
  }

  const isPending = submitW9.isPending || updateW9.isPending;

  return (
    <Card className="rounded-none border-2">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>W-9 Tax Information</CardTitle>
            <CardDescription>Required for tax reporting purposes.</CardDescription>
          </div>
          {isExisting && <StatusBadge status={w9?.status as any} />}
        </div>
      </CardHeader>
      <CardContent>
        {w9?.status === "rejected" && (
          <Alert variant="destructive" className="mb-6 rounded-none">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Action Required</AlertTitle>
            <AlertDescription>
              Your W-9 submission was rejected.{w9.reviewNote ? ` Reason: ${w9.reviewNote}` : " Please review your information and resubmit."}
            </AlertDescription>
          </Alert>
        )}
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="space-y-4">
              <h3 className="text-lg font-bold border-b border-border pb-2">Business Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="legalName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name (as shown on your income tax return)</FormLabel>
                      <FormControl><Input {...field} className="rounded-none" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="businessName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business name/disregarded entity name (optional)</FormLabel>
                      <FormControl><Input {...field} className="rounded-none" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="businessType"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Federal tax classification</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex flex-col space-y-1"
                      >
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl><RadioGroupItem value="sole_proprietor" /></FormControl>
                          <FormLabel className="font-normal">Individual/sole proprietor or single-member LLC</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl><RadioGroupItem value="c_corporation" /></FormControl>
                          <FormLabel className="font-normal">C Corporation</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl><RadioGroupItem value="s_corporation" /></FormControl>
                          <FormLabel className="font-normal">S Corporation</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl><RadioGroupItem value="partnership" /></FormControl>
                          <FormLabel className="font-normal">Partnership</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl><RadioGroupItem value="other" /></FormControl>
                          <FormLabel className="font-normal">Other</FormLabel>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-bold border-b border-border pb-2">Address</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem className="col-span-full">
                      <FormLabel>Address (number, street, and apt. or suite no.)</FormLabel>
                      <FormControl><Input {...field} className="rounded-none" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl><Input {...field} className="rounded-none" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State</FormLabel>
                        <FormControl><Input {...field} className="rounded-none" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="zip"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ZIP code</FormLabel>
                        <FormControl><Input {...field} className="rounded-none" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-bold border-b border-border pb-2">Taxpayer Identification Number</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="taxIdType"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>Type</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex space-x-4"
                        >
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl><RadioGroupItem value="ein" /></FormControl>
                            <FormLabel className="font-normal">Employer ID (EIN)</FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl><RadioGroupItem value="ssn" /></FormControl>
                            <FormLabel className="font-normal">Social Security (SSN)</FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="taxIdLast4"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last 4 Digits</FormLabel>
                      <FormControl><Input {...field} maxLength={4} placeholder="1234" className="rounded-none font-mono" /></FormControl>
                      <FormDescription>For security, we only collect the last 4 digits.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="space-y-4 bg-muted/50 p-4 border border-border">
              <h3 className="text-lg font-bold border-b border-border pb-2">Certification & Signature</h3>
              <FormField
                control={form.control}
                name="agreedToTerms"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-2">
                    <FormControl>
                      <Checkbox
                        checked={field.value === "true"}
                        onCheckedChange={(checked) => field.onChange(checked ? "true" : "false")}
                        className="mt-1"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>
                        I certify under penalties of perjury that the information provided is correct and complete.
                      </FormLabel>
                    </div>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="signatureFullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Digital Signature (Full Legal Name)</FormLabel>
                    <FormControl><Input {...field} className="rounded-none" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button type="submit" disabled={isPending || form.watch("agreedToTerms") !== "true"} className="rounded-none font-bold">
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isExisting ? "Update W-9" : "Submit W-9"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

const insuranceSchema = z.object({
  glCarrier: z.string().min(1, "Carrier is required"),
  glPolicyNumber: z.string().min(1, "Policy number is required"),
  glCoverageAmount: z.string().min(1, "Coverage amount is required"),
  glExpirationDate: z.string().min(1, "Expiration date is required"),
  autoCarrier: z.string().optional(),
  autoPolicyNumber: z.string().optional(),
  autoCoverageAmount: z.string().optional(),
  autoExpirationDate: z.string().optional(),
  wcCarrier: z.string().optional(),
  wcPolicyNumber: z.string().optional(),
  wcExpirationDate: z.string().optional(),
  bondCompany: z.string().optional(),
  bondAmount: z.string().optional(),
  bondExpirationDate: z.string().optional(),
  certificateHolderName: z.string().optional(),
});

function InsuranceTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: ins, isLoading, error } = useGetInsurance();
  const submitIns = useSubmitInsurance();
  const updateIns = useUpdateInsurance();

  const isNotFound = error && (error as any).status === 404;
  const isExisting = !!ins && !isNotFound;

  const form = useForm<z.infer<typeof insuranceSchema>>({
    resolver: zodResolver(insuranceSchema),
    defaultValues: {
      glCarrier: "", glPolicyNumber: "", glCoverageAmount: "", glExpirationDate: "",
      autoCarrier: "", autoPolicyNumber: "", autoCoverageAmount: "", autoExpirationDate: "",
      wcCarrier: "", wcPolicyNumber: "", wcExpirationDate: "",
      bondCompany: "", bondAmount: "", bondExpirationDate: "",
      certificateHolderName: "",
    },
  });

  useEffect(() => {
    if (ins) {
      form.reset({
        glCarrier: ins.glCarrier || "",
        glPolicyNumber: ins.glPolicyNumber || "",
        glCoverageAmount: ins.glCoverageAmount ? String(ins.glCoverageAmount) : "",
        glExpirationDate: ins.glExpirationDate || "",
        autoCarrier: ins.autoCarrier || "",
        autoPolicyNumber: ins.autoPolicyNumber || "",
        autoCoverageAmount: ins.autoCoverageAmount ? String(ins.autoCoverageAmount) : "",
        autoExpirationDate: ins.autoExpirationDate || "",
        wcCarrier: ins.wcCarrier || "",
        wcPolicyNumber: ins.wcPolicyNumber || "",
        wcExpirationDate: ins.wcExpirationDate || "",
        bondCompany: ins.bondCompany || "",
        bondAmount: ins.bondAmount ? String(ins.bondAmount) : "",
        bondExpirationDate: ins.bondExpirationDate || "",
        certificateHolderName: ins.certificateHolderName || "",
      });
    }
  }, [ins, form]);

  if (isLoading) return <Skeleton className="h-[400px] w-full" />;

  function onSubmit(values: z.infer<typeof insuranceSchema>) {
    const payload = {
      ...values,
      glCoverageAmount: Number(values.glCoverageAmount),
      autoCoverageAmount: values.autoCoverageAmount ? Number(values.autoCoverageAmount) : undefined,
      bondAmount: values.bondAmount ? Number(values.bondAmount) : undefined,
    };
    
    const action = isExisting ? updateIns.mutate : submitIns.mutate;
    action({ data: payload as any }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetInsuranceQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAccountStatusQueryKey() });
        toast({ title: isExisting ? "Insurance updated successfully" : "Insurance submitted successfully" });
      },
      onError: () => toast({ title: "Failed to save insurance", variant: "destructive" })
    });
  }

  const isPending = submitIns.isPending || updateIns.isPending;

  return (
    <Card className="rounded-none border-2">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>Insurance & Bonding</CardTitle>
            <CardDescription>Provide your coverage details to bid on jobs.</CardDescription>
          </div>
          {isExisting && <StatusBadge status={ins?.status as any} />}
        </div>
      </CardHeader>
      <CardContent>
        {ins?.status === "rejected" && (
          <Alert variant="destructive" className="mb-6 rounded-none">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Action Required</AlertTitle>
            <AlertDescription>
              Your insurance submission was rejected.{ins.reviewNote ? ` Reason: ${ins.reviewNote}` : " Please review your information and resubmit."}
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Accordion type="multiple" defaultValue={["item-1"]} className="w-full">
              <AccordionItem value="item-1" className="border-border">
                <AccordionTrigger className="font-bold">General Liability (Required)</AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="glCarrier" render={({ field }) => (
                      <FormItem><FormLabel>Carrier Name</FormLabel><FormControl><Input {...field} className="rounded-none" /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="glPolicyNumber" render={({ field }) => (
                      <FormItem><FormLabel>Policy Number</FormLabel><FormControl><Input {...field} className="rounded-none" /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="glCoverageAmount" render={({ field }) => (
                      <FormItem><FormLabel>Coverage Amount ($)</FormLabel><FormControl><Input type="number" {...field} className="rounded-none" /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="glExpirationDate" render={({ field }) => (
                      <FormItem><FormLabel>Expiration Date</FormLabel><FormControl><Input type="date" {...field} className="rounded-none" /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2" className="border-border">
                <AccordionTrigger className="font-bold text-muted-foreground hover:text-foreground">Commercial Auto (Optional)</AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="autoCarrier" render={({ field }) => (
                      <FormItem><FormLabel>Carrier Name</FormLabel><FormControl><Input {...field} className="rounded-none" /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="autoPolicyNumber" render={({ field }) => (
                      <FormItem><FormLabel>Policy Number</FormLabel><FormControl><Input {...field} className="rounded-none" /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="autoCoverageAmount" render={({ field }) => (
                      <FormItem><FormLabel>Coverage Amount ($)</FormLabel><FormControl><Input type="number" {...field} className="rounded-none" /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="autoExpirationDate" render={({ field }) => (
                      <FormItem><FormLabel>Expiration Date</FormLabel><FormControl><Input type="date" {...field} className="rounded-none" /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-3" className="border-border">
                <AccordionTrigger className="font-bold text-muted-foreground hover:text-foreground">Workers Compensation (Optional)</AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="wcCarrier" render={({ field }) => (
                      <FormItem><FormLabel>Carrier Name</FormLabel><FormControl><Input {...field} className="rounded-none" /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="wcPolicyNumber" render={({ field }) => (
                      <FormItem><FormLabel>Policy Number</FormLabel><FormControl><Input {...field} className="rounded-none" /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="wcExpirationDate" render={({ field }) => (
                      <FormItem><FormLabel>Expiration Date</FormLabel><FormControl><Input type="date" {...field} className="rounded-none" /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-4" className="border-border">
                <AccordionTrigger className="font-bold text-muted-foreground hover:text-foreground">Surety Bond (Optional)</AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="bondCompany" render={({ field }) => (
                      <FormItem><FormLabel>Bond Company</FormLabel><FormControl><Input {...field} className="rounded-none" /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="bondAmount" render={({ field }) => (
                      <FormItem><FormLabel>Bond Amount ($)</FormLabel><FormControl><Input type="number" {...field} className="rounded-none" /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="bondExpirationDate" render={({ field }) => (
                      <FormItem><FormLabel>Expiration Date</FormLabel><FormControl><Input type="date" {...field} className="rounded-none" /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
            
            <FormField control={form.control} name="certificateHolderName" render={({ field }) => (
              <FormItem>
                <FormLabel>Certificate Holder Name (if applicable)</FormLabel>
                <FormControl><Input {...field} className="rounded-none" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <Button type="submit" disabled={isPending} className="rounded-none font-bold">
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isExisting ? "Update Insurance" : "Submit Insurance"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

const paymentSchema = z.object({
  methodType: z.enum(["credit_card", "ach", "net_15", "net_30", "net_45"]),
  cardBrand: z.string().optional(),
  cardLast4: z.string().optional(),
  cardExpMonth: z.string().optional(),
  cardExpYear: z.string().optional(),
  cardholderName: z.string().optional(),
  bankName: z.string().optional(),
  accountLast4: z.string().optional(),
  routingLast4: z.string().optional(),
  billingAddress: z.string().optional(),
  billingCity: z.string().optional(),
  billingState: z.string().optional(),
  billingZip: z.string().optional(),
});

function PaymentMethodTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: pm, isLoading, error } = useGetPaymentMethod();
  const { data: profile } = useGetMyProfile();
  const setPm = useSetPaymentMethod();
  const updatePm = useUpdatePaymentMethod();

  const isNotFound = error && (error as any).status === 404;
  const isExisting = !!pm && !isNotFound;

  const form = useForm<z.infer<typeof paymentSchema>>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      methodType: "credit_card",
    },
  });

  useEffect(() => {
    if (pm) {
      form.reset({
        methodType: (pm.methodType as any) || "credit_card",
        cardBrand: pm.cardBrand || "",
        cardLast4: pm.cardLast4 || "",
        cardExpMonth: pm.cardExpMonth || "",
        cardExpYear: pm.cardExpYear || "",
        cardholderName: pm.cardholderName || "",
        bankName: pm.bankName || "",
        accountLast4: pm.accountLast4 || "",
        routingLast4: pm.routingLast4 || "",
        billingAddress: pm.billingAddress || "",
        billingCity: pm.billingCity || "",
        billingState: pm.billingState || "",
        billingZip: pm.billingZip || "",
      });
    }
  }, [pm, form]);

  const methodType = form.watch("methodType");

  if (isLoading) return <Skeleton className="h-[400px] w-full" />;

  function persist(values: Record<string, any>) {
    const action = isExisting ? updatePm.mutate : setPm.mutate;
    action({ data: values } as any, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetPaymentMethodQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAccountStatusQueryKey() });
        toast({ title: isExisting ? "Payment method updated" : "Payment method saved" });
      },
      onError: () => toast({ title: "Failed to save payment method", variant: "destructive" })
    });
  }

  function onSubmit(values: z.infer<typeof paymentSchema>) {
    persist(values);
  }

  // Stripe Elements confirmed the card and returned a PaymentMethod id; persist it
  // (server derives brand/last4/exp from Stripe) along with cardholder + billing.
  function onCardSaved(paymentMethodId: string) {
    const v = form.getValues();
    persist({
      methodType: "credit_card",
      stripePaymentMethodId: paymentMethodId,
      cardholderName: v.cardholderName,
      billingAddress: v.billingAddress,
      billingCity: v.billingCity,
      billingState: v.billingState,
      billingZip: v.billingZip,
    });
  }

  // Stripe verified the bank account and returned a us_bank_account PaymentMethod
  // id; persist it (server derives bank name / last4 from Stripe) with billing.
  // The SetupIntent id lets the server flag whether micro-deposit verification is
  // still pending.
  function onBankSaved(paymentMethodId: string, setupIntentId: string) {
    const v = form.getValues();
    persist({
      methodType: "ach",
      stripePaymentMethodId: paymentMethodId,
      stripeSetupIntentId: setupIntentId,
      billingAddress: v.billingAddress,
      billingCity: v.billingCity,
      billingState: v.billingState,
      billingZip: v.billingZip,
    });
  }

  const isPending = setPm.isPending || updatePm.isPending;

  return (
    <Card className="rounded-none border-2">
      <CardHeader>
        <CardTitle>Billing & Payment Method</CardTitle>
        <CardDescription>Set up how you will pay for completed jobs.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField control={form.control} name="methodType" render={({ field }) => (
              <FormItem className="space-y-3">
                <FormLabel>Payment Type</FormLabel>
                <FormControl>
                  <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {[
                      { value: "credit_card", label: "Credit / Debit Card", icon: CreditCard },
                      { value: "ach", label: "ACH Bank Transfer", icon: Banknote },
                      { value: "net_15", label: "Net 15 Terms", icon: ShieldAlert },
                      { value: "net_30", label: "Net 30 Terms", icon: ShieldAlert },
                      { value: "net_45", label: "Net 45 Terms", icon: ShieldAlert },
                    ].map(option => (
                      <FormItem key={option.value} className="[&>div]:w-full">
                        <FormControl>
                          <RadioGroupItem value={option.value} className="peer sr-only" />
                        </FormControl>
                        <FormLabel className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:text-primary cursor-pointer h-24">
                          <option.icon className="mb-2 h-6 w-6" />
                          {option.label}
                        </FormLabel>
                      </FormItem>
                    ))}
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {methodType === "credit_card" && (
              <div className="space-y-4 border p-4 bg-muted/20">
                <h4 className="font-bold">Card Details</h4>
                {isExisting && pm?.cardLast4 && (
                  <p className="text-sm text-muted-foreground">
                    Saved card on file: <span className="font-mono font-medium">{pm.cardBrand || "Card"} •••• {pm.cardLast4}</span>
                    {pm.cardExpMonth && pm.cardExpYear ? ` (exp ${pm.cardExpMonth}/${pm.cardExpYear})` : ""}. Enter a new card below to replace it.
                  </p>
                )}
                <FormField control={form.control} name="cardholderName" render={({ field }) => (
                  <FormItem className="max-w-md"><FormLabel>Cardholder Name</FormLabel><FormControl><Input {...field} className="rounded-none" /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="space-y-2">
                  <FormLabel>Card</FormLabel>
                  <StripeCardForm
                    onSaved={onCardSaved}
                    saving={isPending}
                    saveLabel={isExisting ? "Replace card" : "Save card"}
                  />
                  <p className="text-xs text-muted-foreground">
                    Card details are entered securely with Stripe — they never touch our servers.
                  </p>
                </div>
              </div>
            )}

            {methodType === "ach" && (
              <div className="space-y-4 border p-4 bg-muted/20">
                <h4 className="font-bold">Bank Account</h4>
                {isExisting && pm?.accountLast4 && (
                  <p className="text-sm text-muted-foreground">
                    Saved bank account on file: <span className="font-mono font-medium">{pm.bankName || "Bank"} •••• {pm.accountLast4}</span>. Connect a new account below to replace it.
                  </p>
                )}
                {isExisting && pm?.verificationStatus === "pending" && (
                  <MicrodepositVerify
                    onVerified={() => {
                      queryClient.invalidateQueries({ queryKey: getGetPaymentMethodQueryKey() });
                      queryClient.invalidateQueries({ queryKey: getGetAccountStatusQueryKey() });
                    }}
                  />
                )}
                <FormField control={form.control} name="cardholderName" render={({ field }) => (
                  <FormItem className="max-w-md"><FormLabel>Account Holder Name</FormLabel><FormControl><Input {...field} className="rounded-none" /></FormControl><FormMessage /></FormItem>
                )} />
                <StripeBankForm
                  onSaved={onBankSaved}
                  saving={isPending}
                  saveLabel={isExisting && pm?.accountLast4 ? "Replace bank account" : "Connect bank account"}
                  accountHolderName={form.watch("cardholderName") || profile?.companyName || profile?.contactName || ""}
                  email={profile?.email || undefined}
                />
              </div>
            )}

            {methodType.startsWith("net_") && (
              <Alert className="rounded-none">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Credit Approval Required</AlertTitle>
                <AlertDescription>Net terms are subject to credit approval. Our team will review your account history before activating this payment method.</AlertDescription>
              </Alert>
            )}

            {(methodType === "credit_card" || methodType === "ach") && (
              <div className="space-y-4">
                <h4 className="font-bold">Billing Address</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="billingAddress" render={({ field }) => (
                    <FormItem className="col-span-full"><FormLabel>Address</FormLabel><FormControl><Input {...field} className="rounded-none" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="billingCity" render={({ field }) => (
                    <FormItem><FormLabel>City</FormLabel><FormControl><Input {...field} className="rounded-none" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="billingState" render={({ field }) => (
                    <FormItem><FormLabel>State</FormLabel><FormControl><Input {...field} className="rounded-none" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="billingZip" render={({ field }) => (
                    <FormItem><FormLabel>ZIP</FormLabel><FormControl><Input {...field} className="rounded-none" /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
              </div>
            )}

            {methodType.startsWith("net_") && (
              <Button type="submit" disabled={isPending} className="rounded-none font-bold">
                {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Payment Method
              </Button>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

const payoutSchema = z.object({
  bankName: z.string().min(1, "Bank name is required"),
  accountHolderName: z.string().min(1, "Account holder name is required"),
  accountType: z.enum(["checking", "savings"]),
  routingNumber: z.string().min(9, "Must be 9 digits").max(9, "Must be 9 digits"),
  accountNumber: z.string().min(4, "Account number required"),
  confirmAccountNumber: z.string(),
}).refine((data) => data.accountNumber === data.confirmAccountNumber, {
  message: "Account numbers don't match",
  path: ["confirmAccountNumber"],
});

function PayoutAccountTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: payout, isLoading, error } = useGetPayoutAccount();
  const { data: payoutStatus, isLoading: isStatusLoading } = useGetPayoutStatus({
    query: {
      queryKey: getGetPayoutStatusQueryKey(),
      // Keep the checklist fresh without a manual reload: refetch when the
      // provider returns to this tab (e.g. after finishing Stripe onboarding
      // in another tab) and poll on a short interval while Stripe still has
      // outstanding requirements (connected but payouts not yet enabled).
      refetchOnWindowFocus: true,
      refetchInterval: (query) =>
        query.state.data && !query.state.data.payoutsEnabled ? 15000 : false,
    },
  });
  const setPayout = useSetPayoutAccount();
  const updatePayout = useUpdatePayoutAccount();
  const connectPayout = useConnectPayoutLink();

  // When Stripe bounces the provider back to this page after hosted onboarding
  // (return URL carries ?payouts=done), refresh the payout status so the
  // checklist reflects what was just completed, then clean up the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payouts") === "done") {
      queryClient.invalidateQueries({ queryKey: getGetPayoutStatusQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetAccountStatusQueryKey() });
      params.delete("payouts");
      const next = window.location.pathname + (params.toString() ? `?${params}` : "") + window.location.hash;
      window.history.replaceState({}, "", next);
    }
  }, [queryClient]);

  // Celebrate the moment Stripe switches payouts on. We only toast on the
  // false → true transition (tracked via a ref), so nothing fires on initial
  // load when payouts were already enabled.
  const wasPayoutsEnabled = useRef<boolean | undefined>(undefined);
  useEffect(() => {
    if (!payoutStatus) return;
    const enabled = !!payoutStatus.payoutsEnabled;
    if (wasPayoutsEnabled.current === false && enabled) {
      toast({
        title: "Payouts enabled",
        description: "You're all set — completed jobs now pay out to your bank automatically.",
      });
    }
    wasPayoutsEnabled.current = enabled;
  }, [payoutStatus, toast]);

  function handleConnectPayout() {
    const returnTo = window.location.origin + window.location.pathname;
    connectPayout.mutate(
      { data: { returnTo } },
      {
        onSuccess: (res) => {
          window.location.href = res.url;
        },
        onError: () => toast({ title: "Couldn't open Stripe onboarding", description: "Please try again.", variant: "destructive" }),
      },
    );
  }

  const isNotFound = error && (error as any).status === 404;
  const isExisting = !!payout && !isNotFound;

  const form = useForm<z.infer<typeof payoutSchema>>({
    resolver: zodResolver(payoutSchema),
    defaultValues: {
      bankName: "",
      accountHolderName: "",
      accountType: "checking",
      routingNumber: "",
      accountNumber: "",
      confirmAccountNumber: "",
    },
  });

  useEffect(() => {
    if (payout) {
      form.reset({
        bankName: payout.bankName || "",
        accountHolderName: payout.accountHolderName || "",
        accountType: (payout.accountType as any) || "checking",
        routingNumber: "", // don't prepopulate sensitive full numbers
        accountNumber: "",
        confirmAccountNumber: "",
      });
    }
  }, [payout, form]);

  if (isLoading) return <Skeleton className="h-[400px] w-full" />;

  function onSubmit(values: z.infer<typeof payoutSchema>) {
    const { confirmAccountNumber, ...payload } = values;
    const action = isExisting ? updatePayout.mutate : setPayout.mutate;
    action({ data: payload as any }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetPayoutAccountQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAccountStatusQueryKey() });
        toast({ title: isExisting ? "Payout account updated" : "Payout account saved" });
        if (isExisting) form.reset({ ...values, routingNumber: "", accountNumber: "", confirmAccountNumber: "" });
      },
      onError: () => toast({ title: "Failed to save payout account", variant: "destructive" })
    });
  }

  const isPending = setPayout.isPending || updatePayout.isPending;

  return (
    <Card className="rounded-none border-2">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>Payout Bank Account</CardTitle>
            <CardDescription>Where you will receive payments for completed jobs.</CardDescription>
          </div>
          {isExisting && <StatusBadge status={payout?.status as any} />}
        </div>
      </CardHeader>
      <CardContent>
        {isExisting && payout?.status !== "rejected" && (
          <div className="mb-6 p-4 border bg-muted/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Banknote className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="font-bold">{payout.bankName} •••• {payout.accountLast4}</p>
                <p className="text-sm text-muted-foreground capitalize">{payout.accountType}</p>
              </div>
            </div>
            <Badge variant="outline" className="rounded-none">Current</Badge>
          </div>
        )}

        {(() => {
          const ps = payoutStatus;
          const enabled = !!ps?.payoutsEnabled;
          const connected = !!ps?.connected;
          const currentlyDue = ps?.requirements?.currentlyDue ?? [];
          const pendingVerification = ps?.requirements?.pendingVerification ?? [];
          const deadline = ps?.requirements?.currentDeadline ?? null;

          if (isStatusLoading) {
            return <Skeleton className="mb-6 h-24 w-full" />;
          }

          if (enabled) {
            return (
              <Alert className="mb-6 rounded-none bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Payouts enabled</AlertTitle>
                <AlertDescription>You're all set — completed jobs pay out to your bank automatically.</AlertDescription>
              </Alert>
            );
          }

          if (!connected) {
            // No Stripe Connect account yet — kick off hosted onboarding.
            return (
              <div className="mb-6 border-2 border-amber-500/30 bg-amber-500/5 p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <Banknote className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <p className="font-bold text-amber-700 dark:text-amber-400">Set up payouts</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Connect a payout account through Stripe to receive payments for completed jobs. It only takes a few minutes.
                </p>
                <Button
                  type="button"
                  onClick={handleConnectPayout}
                  disabled={connectPayout.isPending}
                  className="rounded-none font-bold"
                >
                  {connectPayout.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Connect payout account
                </Button>
              </div>
            );
          }

          // Connected but not yet enabled: show what Stripe still needs.
          return (
            <div className="mb-6 border-2 border-amber-500/30 bg-amber-500/5 p-4 space-y-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <p className="font-bold text-amber-700 dark:text-amber-400">Finish payout setup</p>
              </div>

              {currentlyDue.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold tracking-wide text-foreground">WHAT STRIPE STILL NEEDS</p>
                  <ul className="space-y-1.5">
                    {currentlyDue.map((req) => (
                      <li key={req.code} className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                        <span className="text-sm leading-snug">{req.label}</span>
                      </li>
                    ))}
                  </ul>
                  {deadline && (
                    <p className="text-xs text-destructive">
                      Complete by {new Date(deadline * 1000).toLocaleDateString()} to avoid a payout hold.
                    </p>
                  )}
                </div>
              )}

              {pendingVerification.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold tracking-wide text-muted-foreground">STRIPE IS REVIEWING</p>
                  <ul className="space-y-1.5">
                    {pendingVerification.map((req) => (
                      <li key={req.code} className="flex items-start gap-2">
                        <Clock className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                        <span className="text-sm leading-snug text-muted-foreground">{req.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {currentlyDue.length === 0 && pendingVerification.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Stripe is finishing your review. Payouts turn on once approved — check back shortly.
                </p>
              )}

              {currentlyDue.length > 0 && (
                <Button
                  type="button"
                  onClick={handleConnectPayout}
                  disabled={connectPayout.isPending}
                  className="rounded-none font-bold"
                >
                  {connectPayout.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Continue onboarding
                </Button>
              )}
            </div>
          );
        })()}

        <Alert className="mb-6 rounded-none bg-blue-50/50 text-blue-900 border-blue-200 dark:bg-blue-900/20 dark:text-blue-200 dark:border-blue-800">
          <ShieldAlert className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertTitle>Secure Storage</AlertTitle>
          <AlertDescription>Your bank information is encrypted and stored securely. We only display the last 4 digits after saving.</AlertDescription>
        </Alert>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="bankName" render={({ field }) => (
                <FormItem><FormLabel>Bank Name</FormLabel><FormControl><Input {...field} className="rounded-none" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="accountHolderName" render={({ field }) => (
                <FormItem><FormLabel>Name on Account</FormLabel><FormControl><Input {...field} className="rounded-none" /></FormControl><FormMessage /></FormItem>
              )} />
            </div>

            <FormField control={form.control} name="accountType" render={({ field }) => (
              <FormItem className="space-y-3">
                <FormLabel>Account Type</FormLabel>
                <FormControl>
                  <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex space-x-4">
                    <FormItem className="flex items-center space-x-2 space-y-0">
                      <FormControl><RadioGroupItem value="checking" /></FormControl>
                      <FormLabel className="font-normal">Checking</FormLabel>
                    </FormItem>
                    <FormItem className="flex items-center space-x-2 space-y-0">
                      <FormControl><RadioGroupItem value="savings" /></FormControl>
                      <FormLabel className="font-normal">Savings</FormLabel>
                    </FormItem>
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="routingNumber" render={({ field }) => (
                <FormItem className="col-span-full"><FormLabel>Routing Number (9 digits)</FormLabel><FormControl><Input {...field} maxLength={9} className="rounded-none font-mono" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="accountNumber" render={({ field }) => (
                <FormItem><FormLabel>Account Number</FormLabel><FormControl><Input type="password" {...field} className="rounded-none font-mono" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="confirmAccountNumber" render={({ field }) => (
                <FormItem><FormLabel>Confirm Account Number</FormLabel><FormControl><Input type="password" {...field} className="rounded-none font-mono" /></FormControl><FormMessage /></FormItem>
              )} />
            </div>

            <Button type="submit" disabled={isPending} className="rounded-none font-bold">
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isExisting ? "Update Bank Account" : "Save Bank Account"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function ComplianceTab() {
  const { data: profile } = useGetMyProfile();
  const { data: status, isLoading } = useGetAccountStatus();
  
  if (isLoading || !status || !profile) return <Skeleton className="h-[400px] w-full" />;

  const isCustomer = profile.role === "customer";
  const isProvider = profile.role === "provider";

  return (
    <Card className="rounded-none border-2">
      <CardHeader>
        <CardTitle>Account Status</CardTitle>
        <CardDescription>Overview of your account verification and readiness.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {(!status.canBid && isProvider) || (!status.canPost && isCustomer) ? (
          <Alert variant="destructive" className="rounded-none bg-destructive/5 text-destructive border-destructive/20">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Action Required</AlertTitle>
            <AlertDescription>
              Your account is not fully set up. Complete the sections below to start {isProvider ? "bidding on" : "posting"} jobs.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="rounded-none bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Ready to Go</AlertTitle>
            <AlertDescription>Your account is fully verified and ready.</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4">
          <div className="flex items-center justify-between p-4 border-2 border-border bg-card">
            <div className="flex flex-col">
              <span className="font-bold">Profile Completeness</span>
              <span className="text-sm text-muted-foreground">Basic contact information</span>
            </div>
            {status.profileComplete ? <StatusBadge status="verified" text="Complete" /> : <StatusBadge status="not_submitted" text="Incomplete" />}
          </div>

          {isProvider && (
            <>
              <div className="flex items-center justify-between p-4 border-2 border-border bg-card">
                <div className="flex flex-col">
                  <span className="font-bold">W-9 Tax Form</span>
                  <span className="text-sm text-muted-foreground">Required for payout reporting</span>
                </div>
                <StatusBadge status={status.w9Status as any} />
              </div>

              <div className="flex items-center justify-between p-4 border-2 border-border bg-card">
                <div className="flex flex-col">
                  <span className="font-bold">Insurance & Bonding</span>
                  <span className="text-sm text-muted-foreground">Liability coverage verification</span>
                </div>
                <StatusBadge status={status.insuranceStatus as any} />
              </div>

              <div className="flex items-center justify-between p-4 border-2 border-border bg-card">
                <div className="flex flex-col">
                  <span className="font-bold">DOT / CDL Compliance</span>
                  <span className="text-sm text-muted-foreground">Carrier operating credentials</span>
                </div>
                <StatusBadge status={status.dotCdlStatus as any} />
              </div>

              <div className="flex items-center justify-between p-4 border-2 border-border bg-card">
                <div className="flex flex-col">
                  <span className="font-bold">Payout Account</span>
                  <span className="text-sm text-muted-foreground">Bank account for receiving funds</span>
                </div>
                <StatusBadge status={status.payoutStatus as any} />
              </div>
            </>
          )}

          {isCustomer && (
            <div className="flex items-center justify-between p-4 border-2 border-border bg-card">
              <div className="flex flex-col">
                <span className="font-bold">Payment Method</span>
                <span className="text-sm text-muted-foreground">Billing source for accepted bids</span>
              </div>
              <StatusBadge status={status.paymentStatus === "set" ? "verified" : "not_set"} text={status.paymentStatus === "set" ? "Set" : "Not Set"} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(path, { ...options, headers: { "Content-Type": "application/json", ...options?.headers } });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Request failed"); }
  return res.json();
}

function DotCdlTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({ dotNumber: "", mcNumber: "", cdlNumber: "", cdlState: "", cdlClass: "A", cdlExpiry: "" });

  const { data: record, isLoading } = useGetCompliance();

  const submit = useSubmitCompliance({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getGetComplianceQueryKey() }); toast({ title: "Compliance info submitted for review" }); },
      onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
    },
  });

  const verify = useVerifyCompliance({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getGetComplianceQueryKey() }); toast({ title: "Credentials verified (demo)" }); },
      onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
    },
  });

  const submitForm = () => submit.mutate({
    data: {
      dotNumber: form.dotNumber || undefined,
      mcNumber: form.mcNumber || undefined,
      cdlNumber: form.cdlNumber || undefined,
      cdlState: form.cdlState || undefined,
      cdlClass: form.cdlClass || undefined,
      cdlExpiry: form.cdlExpiry || undefined,
    },
  });

  React.useEffect(() => {
    if (record) {
      setForm({
        dotNumber: record.dotNumber || "",
        mcNumber: record.mcNumber || "",
        cdlNumber: record.cdlNumber || "",
        cdlState: record.cdlState || "",
        cdlClass: record.cdlClass || "A",
        cdlExpiry: record.cdlExpiry ? new Date(record.cdlExpiry).toISOString().split("T")[0] : "",
      });
    }
  }, [record]);

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  const statusColor = !record ? "border-gray-200 bg-gray-50" :
    record.status === "verified" ? "border-green-200 bg-green-50" :
    record.status === "pending" ? "border-amber-200 bg-amber-50" :
    record.status === "rejected" ? "border-red-200 bg-red-50" : "border-gray-200 bg-gray-50";

  return (
    <Card className="rounded-none border-2">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" />DOT / CDL Verification</CardTitle>
            <CardDescription>Verify your DOT number and CDL credentials to unlock more jobs</CardDescription>
          </div>
          {record && (
            <StatusBadge
              status={
                record.status === "verified" ? "verified"
                  : record.status === "pending" ? "pending"
                  : record.status === "rejected" ? "rejected"
                  : "not_submitted"
              }
            />
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {record?.status === "verified" && (
          <Alert className="rounded-none border-green-200 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">Verified</AlertTitle>
            <AlertDescription className="text-green-700">Your DOT number and CDL are verified. You can bid on all job types.</AlertDescription>
          </Alert>
        )}
        {record?.status === "rejected" && (
          <Alert variant="destructive" className="rounded-none">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Action Required</AlertTitle>
            <AlertDescription>
              Your DOT/CDL submission was rejected.{record.reviewNote ? ` Reason: ${record.reviewNote}` : " Please update your credentials and resubmit."}
            </AlertDescription>
          </Alert>
        )}
        {record?.status === "pending" && (
          <Alert className={`rounded-none ${statusColor}`}>
            <Clock className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800">Under Review</AlertTitle>
            <AlertDescription className="text-amber-700 space-y-2">
              <span>Your credentials are being verified (typically 1–2 business days).</span>
              <Button size="sm" variant="outline" className="rounded-none border-amber-400 text-amber-800 mt-2 block" onClick={() => verify.mutate({})} disabled={verify.isPending}>
                {verify.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}Simulate Verification (Demo)
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">USDOT Number</Label>
            <Input className="rounded-none mt-1 font-mono" value={form.dotNumber} onChange={e => setForm(f => ({ ...f, dotNumber: e.target.value }))} placeholder="1234567" />
            {record?.dotVerified && <p className="text-xs text-green-600 mt-1 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Verified</p>}
          </div>
          <div>
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">CDL Number</Label>
            <Input className="rounded-none mt-1 font-mono" value={form.cdlNumber} onChange={e => setForm(f => ({ ...f, cdlNumber: e.target.value }))} placeholder="D1234-56789-01234" />
            {record?.cdlVerified && <p className="text-xs text-green-600 mt-1 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Verified</p>}
          </div>
          <div>
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">CDL Issuing State</Label>
            <Input className="rounded-none mt-1" value={form.cdlState} onChange={e => setForm(f => ({ ...f, cdlState: e.target.value }))} placeholder="TX" maxLength={2} />
          </div>
          <div>
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">CDL Class</Label>
            <Select value={form.cdlClass} onValueChange={v => setForm(f => ({ ...f, cdlClass: v }))}>
              <SelectTrigger className="rounded-none mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="A">Class A — Combination vehicles</SelectItem>
                <SelectItem value="B">Class B — Heavy straight vehicles</SelectItem>
                <SelectItem value="C">Class C — Small vehicles</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">CDL Expiry Date</Label>
            <Input className="rounded-none mt-1" type="date" value={form.cdlExpiry} onChange={e => setForm(f => ({ ...f, cdlExpiry: e.target.value }))} />
          </div>
        </div>

        <div>
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">MC Number</Label>
          <Input className="rounded-none mt-1 font-mono" value={form.mcNumber} onChange={e => setForm(f => ({ ...f, mcNumber: e.target.value }))} placeholder="MC-123456" />
        </div>

        {record && (
          <div className="border-2 border-border">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-4 pt-4">FMCSA Authority Checks</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-border mt-3">
              {[
                { label: "Operating Authority (FMCSA)", value: record.fmcsaAuthority },
                { label: "Active Insurance on File", value: record.insuranceActive },
                { label: "DOT Operating Status", value: record.dotOperatingStatus },
                { label: "Not Out-of-Service / Suspended", value: record.notSuspended },
              ].map((c) => (
                <div key={c.label} className="bg-background p-3 flex items-center justify-between gap-2">
                  <span className="text-sm">{c.label}</span>
                  {c.value === "verified" ? (
                    <Badge className="bg-green-500 hover:bg-green-600 rounded-none text-xs"><CheckCircle2 className="w-3 h-3 mr-1" />Verified</Badge>
                  ) : c.value === "failed" ? (
                    <Badge variant="destructive" className="rounded-none text-xs"><AlertCircle className="w-3 h-3 mr-1" />Failed</Badge>
                  ) : (
                    <Badge variant="secondary" className="rounded-none text-xs text-muted-foreground"><Clock className="w-3 h-3 mr-1" />Unknown</Badge>
                  )}
                </div>
              ))}
            </div>
            {record.safetyRating && (
              <p className="text-xs text-muted-foreground px-4 py-3 border-t border-border">
                Safety rating: <span className="font-bold text-foreground">{record.safetyRating}</span>
                {record.complianceCheckedAt ? ` · Checked ${new Date(record.complianceCheckedAt).toLocaleDateString()}` : ""}
              </p>
            )}
          </div>
        )}

        <div className="bg-muted/30 p-4 border border-border space-y-1">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Why verify?</p>
          {["Unlock premium high-value jobs", "Display verified badge on your profile", "Faster bid acceptance from customers", "Required for interstate hauls"].map(i => (
            <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0" />{i}</div>
          ))}
        </div>

        <Button className="rounded-none font-bold w-full" disabled={submit.isPending} onClick={submitForm}>
          {submit.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
          {record ? "Update & Resubmit" : "Submit for Verification"}
        </Button>
      </CardContent>
    </Card>
  );
}

function CreditApplicationTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({ wantsInvoicing: false, tradeReferences: "", bankReference: "", estimatedMonthlySpend: "" });

  const { data: record, isLoading } = useGetCreditApplication();

  const submit = useSubmitCreditApplication({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getGetCreditApplicationQueryKey() }); toast({ title: "Credit application submitted for review" }); },
      onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
    },
  });

  React.useEffect(() => {
    if (record) {
      setForm({
        wantsInvoicing: !!record.wantsInvoicing,
        tradeReferences: record.tradeReferences || "",
        bankReference: record.bankReference || "",
        estimatedMonthlySpend: record.estimatedMonthlySpend != null ? String(record.estimatedMonthlySpend) : "",
      });
    }
  }, [record]);

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  const submitForm = () => submit.mutate({
    data: {
      wantsInvoicing: form.wantsInvoicing,
      tradeReferences: form.tradeReferences || undefined,
      bankReference: form.bankReference || undefined,
      estimatedMonthlySpend: form.estimatedMonthlySpend ? Number(form.estimatedMonthlySpend) : undefined,
    },
  });

  return (
    <Card className="rounded-none border-2">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />Credit Application</CardTitle>
            <CardDescription>Apply for Net invoicing terms so you can hire trucks and pay later.</CardDescription>
          </div>
          {record && (
            <StatusBadge
              status={record.status === "approved" ? "verified" : record.status === "pending" ? "pending" : record.status === "rejected" ? "rejected" : "not_submitted"}
              text={record.status === "approved" ? "Approved" : record.status === "rejected" ? "Rejected" : record.status === "pending" ? "Under Review" : "Not Submitted"}
            />
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {record?.status === "approved" && (
          <Alert className="rounded-none border-green-200 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">Credit Approved</AlertTitle>
            <AlertDescription className="text-green-700">You can select Net payment terms when paying for completed jobs.</AlertDescription>
          </Alert>
        )}
        {record?.status === "pending" && (
          <Alert className="rounded-none border-amber-200 bg-amber-50">
            <Clock className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800">Under Review</AlertTitle>
            <AlertDescription className="text-amber-700">Our team is reviewing your credit application (typically 1–3 business days).</AlertDescription>
          </Alert>
        )}

        <label className="flex items-center gap-3 cursor-pointer">
          <Checkbox checked={form.wantsInvoicing} onCheckedChange={(v) => setForm(f => ({ ...f, wantsInvoicing: !!v }))} />
          <span className="text-sm font-medium">I want to pay by invoice (Net terms) instead of card up front</span>
        </label>

        <div>
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Estimated Monthly Spend ($)</Label>
          <Input className="rounded-none mt-1" type="number" inputMode="decimal" value={form.estimatedMonthlySpend} onChange={e => setForm(f => ({ ...f, estimatedMonthlySpend: e.target.value }))} placeholder="25000" />
        </div>
        <div>
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Trade References</Label>
          <Input className="rounded-none mt-1" value={form.tradeReferences} onChange={e => setForm(f => ({ ...f, tradeReferences: e.target.value }))} placeholder="Supplier names, contacts, account #s" />
        </div>
        <div>
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Bank Reference</Label>
          <Input className="rounded-none mt-1" value={form.bankReference} onChange={e => setForm(f => ({ ...f, bankReference: e.target.value }))} placeholder="Bank name & account officer" />
        </div>

        <Button className="rounded-none font-bold w-full" disabled={submit.isPending} onClick={submitForm}>
          {submit.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
          {record ? "Update & Resubmit" : "Submit Credit Application"}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function AccountPage() {
  const { data: profile, isLoading } = useGetMyProfile();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isCustomer = profile?.role === "customer";
  const isProvider = profile?.role === "provider";

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Account Settings</h1>
        <p className="text-muted-foreground">Manage your profile, compliance, and billing information.</p>
      </div>

      <Tabs defaultValue="status" className="w-full">
        <TabsList className="flex flex-wrap h-auto rounded-none justify-start gap-2 bg-transparent p-0 mb-6">
          <TabsTrigger value="status" className="rounded-none border-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/10">Status</TabsTrigger>
          <TabsTrigger value="profile" className="rounded-none border-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/10">Profile</TabsTrigger>
          {isProvider && <TabsTrigger value="w9" className="rounded-none border-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/10">W-9 Form</TabsTrigger>}
          {isProvider && <TabsTrigger value="insurance" className="rounded-none border-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/10">Insurance</TabsTrigger>}
          {isProvider && <TabsTrigger value="payout" className="rounded-none border-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/10">Payout Account</TabsTrigger>}
          {isProvider && <TabsTrigger value="dotcdl" className="rounded-none border-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/10">DOT / CDL</TabsTrigger>}
          {isCustomer && <TabsTrigger value="payment" className="rounded-none border-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/10">Payment Method</TabsTrigger>}
          {isCustomer && <TabsTrigger value="credit" className="rounded-none border-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/10">Credit Application</TabsTrigger>}
        </TabsList>
        
        <TabsContent value="status" className="mt-0"><ComplianceTab /></TabsContent>
        <TabsContent value="profile" className="mt-0"><ProfileTab /></TabsContent>
        {isProvider && <TabsContent value="w9" className="mt-0"><W9Tab /></TabsContent>}
        {isProvider && <TabsContent value="insurance" className="mt-0"><InsuranceTab /></TabsContent>}
        {isProvider && <TabsContent value="payout" className="mt-0"><PayoutAccountTab /></TabsContent>}
        {isProvider && <TabsContent value="dotcdl" className="mt-0"><DotCdlTab /></TabsContent>}
        {isCustomer && <TabsContent value="payment" className="mt-0"><PaymentMethodTab /></TabsContent>}
        {isCustomer && <TabsContent value="credit" className="mt-0"><CreditApplicationTab /></TabsContent>}
      </Tabs>
    </div>
  );
}
