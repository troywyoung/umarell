import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { API } from "../config";

export interface InstanceConfig {
  instance_key: string;
  prompts: Record<string, any>;
  design_tokens: {
    colors: {
      primary: {
        accent: string;
        dark_bg: string;
        light_bg: string;
        white: string;
        dark_text: string;
      };
      confidence_scores: Record<string, string>;
      backgrounds: Record<string, string>;
      text: Record<string, string>;
      ui: Record<string, string>;
    };
    typography: {
      fonts: Record<string, string>;
      sizes: Record<string, string>;
      weights: Record<string, number>;
      letter_spacing: Record<string, string>;
      line_heights: Record<string, number>;
    };
    spacing: Record<string, Record<string, string>>;
    borders: { radius: Record<string, string> };
    shadows: Record<string, string>;
    layout: Record<string, string>;
    animations: {
      durations: Record<string, string>;
      easing: Record<string, string>;
    };
  };
  ui_copy: {
    page_title: string;
    placeholder_prompts: string[];
    response_placeholders: string[];
    labels: {
      hot_take_badge: string;
      empty_state: string;
      say_your_take: string;
      add_link_optional: string;
      listening: string;
    };
  };
}

interface InstanceContextValue {
  config: InstanceConfig | null;
  loading: boolean;
  error: Error | null;
  instanceKey: string;
}

const InstanceContext = createContext<InstanceContextValue>({
  config: null,
  loading: true,
  error: null,
  instanceKey: "hot-takes",
});

export function useInstanceConfig() {
  return useContext(InstanceContext);
}

interface InstanceProviderProps {
  children: ReactNode;
  instanceKey?: string;
}

export function InstanceProvider({ children, instanceKey: propInstanceKey }: InstanceProviderProps) {
  const [config, setConfig] = useState<InstanceConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Extract instance key from URL path, e.g., /hot-takes/... -> "hot-takes"
  const getInstanceKeyFromPath = (): string => {
    const path = window.location.pathname;
    const match = path.match(/^\/([a-z0-9-]+)/);
    if (match) {
      const key = match[1];
      // Exclude meta routes
      if (!["admin", "auth", "health", "instance"].includes(key)) {
        return key;
      }
    }
    return propInstanceKey || "hot-takes";
  };

  const [instanceKey, setInstanceKey] = useState(getInstanceKeyFromPath);

  // Update instance key when URL changes (for SPA navigation)
  useEffect(() => {
    const handleLocationChange = () => {
      const newKey = getInstanceKeyFromPath();
      if (newKey !== instanceKey) {
        setInstanceKey(newKey);
      }
    };

    // Listen for popstate (browser back/forward)
    window.addEventListener("popstate", handleLocationChange);
    return () => window.removeEventListener("popstate", handleLocationChange);
  }, [instanceKey]);

  useEffect(() => {
    async function fetchConfig() {
      try {
        setLoading(true);
        const response = await fetch(`${API}/instance/${instanceKey}/config`);
        if (!response.ok) {
          throw new Error(`Failed to fetch config: ${response.statusText}`);
        }
        const data = await response.json();
        setConfig(data);

        // Update page title dynamically
        if (data.ui_copy?.page_title) {
          document.title = data.ui_copy.page_title;
        }

        // Apply design tokens as CSS custom properties
        if (data.design_tokens) {
          applyDesignTokens(data.design_tokens);
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Unknown error"));
        console.error("Failed to load instance config:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchConfig();
  }, [instanceKey]);

  return (
    <InstanceContext.Provider value={{ config, loading, error, instanceKey }}>
      {children}
    </InstanceContext.Provider>
  );
}

function applyDesignTokens(tokens: InstanceConfig["design_tokens"]) {
  const root = document.documentElement;

  // Apply color tokens
  if (tokens.colors) {
    root.style.setProperty("--color-accent", tokens.colors.primary.accent);
    root.style.setProperty("--color-dark-bg", tokens.colors.primary.dark_bg);
    root.style.setProperty("--color-light-bg", tokens.colors.primary.light_bg);
    root.style.setProperty("--color-white", tokens.colors.primary.white);
    root.style.setProperty("--color-dark-text", tokens.colors.primary.dark_text);
    // Secondary colors
    if (tokens.colors.backgrounds) {
      root.style.setProperty("--color-secondary-bg", (tokens.colors.backgrounds as any).secondary ?? "#F0F0ED");
      root.style.setProperty("--color-card-bg", (tokens.colors.backgrounds as any).card_white ?? "#FFFFFF");
      root.style.setProperty("--color-collection-card-bg", (tokens.colors.backgrounds as any).collection_card ?? "#F5F0E8");
    }
    if (tokens.colors.text) {
      root.style.setProperty("--color-secondary-text", (tokens.colors.text as any).secondary_dark ?? "#888");
    }
  }

  // Apply typography tokens
  if (tokens.typography) {
    root.style.setProperty("--font-system", tokens.typography.fonts.system);
    root.style.setProperty("--font-display", tokens.typography.fonts.display);
    if (tokens.typography.sizes?.base) root.style.setProperty("--font-size-base", tokens.typography.sizes.base);
    if ((tokens.typography.sizes as any)?.card_headline) root.style.setProperty("--font-size-card-headline", (tokens.typography.sizes as any).card_headline);
    if ((tokens.typography.sizes as any)?.detail_headline) root.style.setProperty("--font-size-detail-headline", (tokens.typography.sizes as any).detail_headline);
    if (tokens.typography.weights?.bold !== undefined) root.style.setProperty("--font-weight-bold", String(tokens.typography.weights.bold));
    // Also update body font directly so all `font-family: inherit` elements pick it up
    document.body.style.fontFamily = tokens.typography.fonts.system;
  }

  // Layout tokens
  if ((tokens.layout as any)?.max_width) {
    root.style.setProperty("--max-content-width", (tokens.layout as any).max_width);
  }

  // Shadow tokens
  if ((tokens.shadows as any)?.card) {
    root.style.setProperty("--shadow-card", (tokens.shadows as any).card);
  }

  // Apply full-page background image (cover, fixed) directly to body
  const bgImage = (tokens.layout as any)?.feed_bg_image ?? "";
  const darkBg = tokens.colors?.primary?.dark_bg ?? "#12102B";
  document.body.style.backgroundColor = darkBg;
  if (bgImage) {
    document.body.style.backgroundImage = `url(${bgImage})`;
    document.body.style.backgroundSize = "cover";
    document.body.style.backgroundPosition = "center center";
    document.body.style.backgroundRepeat = "no-repeat";
    document.body.style.backgroundAttachment = "fixed";
  } else {
    document.body.style.backgroundImage = "none";
  }

  // Apply spacing tokens
  if (tokens.spacing) {
    Object.entries(tokens.spacing.padding).forEach(([key, value]) => {
      root.style.setProperty(`--padding-${key}`, value);
    });
  }

  // Apply border radius tokens
  if (tokens.borders) {
    Object.entries(tokens.borders.radius).forEach(([key, value]) => {
      root.style.setProperty(`--radius-${key}`, value);
    });
  }
}
