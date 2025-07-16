import { Eye } from "lucide-react";

interface ProjectPreviewProps {
  inputMethod: "url" | "files";
  websiteUrl?: string;
  files?: File[];
}

export function ProjectPreview({ inputMethod, websiteUrl, files }: ProjectPreviewProps) {
  const renderPreview = () => {
    if (inputMethod === "url" && websiteUrl) {
      return (
        <div className="border border-gray-300 rounded-lg bg-white aspect-video overflow-hidden">
          <iframe
            src={websiteUrl}
            className="w-full h-full"
            title="Website Preview"
            sandbox="allow-same-origin allow-scripts"
          />
        </div>
      );
    }

    if (inputMethod === "files" && files && files.length > 0) {
      const htmlFile = files.find(file => file.name.endsWith('.html'));
      
      if (htmlFile) {
        return (
          <div className="border border-gray-300 rounded-lg bg-white aspect-video p-4">
            <div className="text-center">
              <div className="text-sm text-gray-500 mb-2">HTML File Preview</div>
              <div className="text-sm font-medium text-gray-900">{htmlFile.name}</div>
              <div className="text-xs text-gray-500 mt-1">
                {files.length} file(s) uploaded
              </div>
            </div>
          </div>
        );
      }
    }

    return (
      <div className="border border-gray-300 rounded-lg bg-gray-50 aspect-video flex items-center justify-center">
        <div className="text-center">
          <Eye className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Preview will appear here</p>
        </div>
      </div>
    );
  };

  return renderPreview();
}
