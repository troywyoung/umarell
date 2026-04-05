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
}

const InstanceContext = createContext<InstanceContextValue>({
  config: null,
  loading: true,
  error: null,
});

export function useInstanceConfig() {
  return useContext(InstanceContext);
}

interface InstanceProviderProps {
  children: ReactNode;
  instanceKey?: string;
}

export function InstanceProvider({ children, instanceKey = "hot-takes" }: InstanceProviderProps) {
  const [config, setConfig] = useState<InstanceConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

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
    <InstanceContext.Provider value={{ config, loading, error }}>
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
  }

  // Apply typography tokens
  if (tokens.typography) {
    root.style.setProperty("--font-system", tokens.typography.fonts.system);
    root.style.setProperty("--font-display", tokens.typography.fonts.display);
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
