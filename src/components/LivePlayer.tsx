"use client";
import { useState, useEffect } from "react";

export default function LivePlayer() {
  const [activeTab, setActiveTab] = useState<"tiktok" | "twitch">("tiktok");
  const [hostname, setHostname] = useState("localhost");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // schedule mounted state to avoid synchronous setState inside effect
    const id = window.setTimeout(() => {
      setMounted(true);
      if (typeof window !== "undefined") {
        setHostname(window.location.hostname);
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  // charger dynamiquement le script TikTok uniquement quand l'onglet TikTok est actif ET après le mount
  useEffect(() => {
    if (!mounted || activeTab !== "tiktok") return;
    const id = "tiktok-embed-script";
    if (document.getElementById(id)) return;
    const s = document.createElement("script");
    s.id = id;
    s.async = true;
    s.src = "https://www.tiktok.com/embed.js";
    document.body.appendChild(s);
    // pas de suppression du script au unmount pour éviter de casser d'autres embeds
  }, [mounted, activeTab]);


  return (
    <div className="w-full px-4 live-player">
  <div className="max-w-full mx-auto">
        {/* Onglets */}
      
        <div className="flex border-b mb-4 tabs">
          <button
            className={`tab-btn ${activeTab === "tiktok" ? "active tiktok" : ""}`}
            onClick={() => setActiveTab("tiktok")}
          >
            🎵 TikTok
          </button>
          
          <button
            className={`tab-btn ${activeTab === "twitch" ? "active twitch" : ""}`}
            onClick={() => setActiveTab("twitch")}
          >
            🎮 Twitch
          </button>
          
        </div>

        {/* Contenu responsive */}
        <div className="player-wrap">
          {/* Ne rendre l'embed TikTok que côté client pour éviter les erreurs de hydration */}
          {activeTab === "tiktok" && mounted && (
            <div className="iframely-embed">
              <blockquote
                className="tiktok-embed"
                cite="https://www.tiktok.com/@foxybwitch"
                data-unique-id="foxybwitch"
                data-embed-type="creator"
                style={{ maxWidth: '100%', minWidth: 288 }}
              >
                <section>
                  <a
                    target="_blank"
                    rel="noreferrer"
                    href="https://www.tiktok.com/@foxybwitch?refer=creator_embed"
                  >
                    @foxybwitch
                  </a>
                </section>
              </blockquote>
              {/* Le script TikTok est chargé dynamiquement par useEffect */}
            </div>
          )}

          {/* Ne rendre l'iframe Twitch que côté client (hostname disponible) */}
          {activeTab === "twitch" && mounted && (
            <iframe
              src={`https://player.twitch.tv/?channel=fluffradioofficiel&parent=${hostname}&autoplay=true&muted=true`}
              allow="autoplay; fullscreen; encrypted-media"
              allowFullScreen
              className="w-full h-full"
            />
          )}
        </div>
      </div>
    </div>
  );
}
