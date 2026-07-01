import { Spinner } from "@/components/ui/spinner";

type ButtonLoadingProps = {
  isLoading: boolean;
  children: React.ReactNode;
  loadingText?: React.ReactNode;
  spinnerClassName?: string;
};

export function ButtonLoading({
  isLoading,
  children,
  loadingText,
  spinnerClassName = "mr-2",
}: ButtonLoadingProps) {
  if (!isLoading) return <>{children}</>;

  return (
    <>
      <Spinner className={spinnerClassName} />
      {loadingText ?? children}
    </>
  );
}
