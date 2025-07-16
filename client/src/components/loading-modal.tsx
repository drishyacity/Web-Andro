import { Dialog, DialogContent } from "@/components/ui/dialog";

interface LoadingModalProps {
  isOpen: boolean;
  message?: string;
}

export function LoadingModal({ isOpen, message = "Processing..." }: LoadingModalProps) {
  return (
    <Dialog open={isOpen}>
      <DialogContent className="sm:max-w-md">
        <div className="py-6 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{message}</h3>
          <p className="text-gray-600">Please wait while we process your request.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
