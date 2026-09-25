import { useState, useEffect } from "react";

interface Button {
  Name: string;
  Link: string;
}

interface Promotion {
  title: string;
  message?: string;
  imageUrl?: string;
  button?: Button;
}

interface Props {
  promotion: Promotion | null;
}

const PromotionPopup: React.FC<Props> = ({ promotion }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (visible) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [visible]);

  if (!promotion || !visible) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
      <div className="glass-modal w-full max-w-sm max-h-[90vh] overflow-hidden relative flex flex-col animate-scaleIn">
        {/* Scrollable content */}
        <div className="overflow-y-auto flex-grow p-0">
          {/* Sticky top title */}
          <div className="sticky top-0 z-10 px-6 pt-5 pb-3 border-b border-[var(--glass-border)] bg-transparent backdrop-blur-xl">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-cyan-300 bg-clip-text text-transparent">
                {promotion.title}
              </h2>
              <button
                onClick={() => setVisible(false)}
                className="text-muted-foreground text-xl w-8 h-8 rounded-full hover:bg-accent/50 flex items-center justify-center transition-all duration-200"
              >
                &times;
              </button>
            </div>
          </div>

          {/* Scrollable content */}
          <div className="px-6 pb-6">
            {promotion.imageUrl && (
              <img
                src={promotion.imageUrl}
                alt="Promotion"
                className="rounded-xl w-full max-h-64 object-cover my-4 border border-[var(--glass-border)]"
              />
            )}

            {promotion.message && (
              <p className="text-foreground/80 whitespace-pre-line text-left leading-relaxed">
                {promotion.message}
              </p>
            )}
          </div>
        </div>

        {/* Sticky bottom button */}
        {promotion.button?.Link && /^https?:\/\//.test(promotion.button.Link) && (
          <div className="sticky bottom-0 backdrop-blur-xl border-t border-[var(--glass-border)] px-6 py-4">
            <a
              href={promotion.button.Link}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center btn-3d py-2.5"
            >
              {promotion.button.Name || "Learn More"}
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default PromotionPopup;
