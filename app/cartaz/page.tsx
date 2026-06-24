"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import Bunting from "@/components/Bunting";

export default function Cartaz() {
  const [qr, setQr] = useState("");
  const [url, setUrl] = useState("");
  const [size, setSize] = useState<"A4" | "A3">("A4");

  useEffect(() => {
    const u = "https://festajuninamarista.vercel.app/";
    setUrl(u);
    QRCode.toDataURL(u, { width: 1000, margin: 1, errorCorrectionLevel: "M", color: { dark: "#15375d", light: "#ffffff" } })
      .then(setQr).catch(() => {});
  }, []);

  return (
    <div className="cartaz">
      <style>{`@media print{@page{size:${size} portrait;margin:0;}}`}</style>
      <Bunting />
      <div className="cartaz-top">
        <div className="cartaz-kicker">Colégio Marista de Brasília</div>
        <h1 className="cartaz-title">Arraiá<br />do Tesouro</h1>
        <div className="cartaz-festa">Festa Junina 2026</div>
      </div>

      <div className="cartaz-qrcard">
        {qr ? <img src={qr} alt="QR Code do jogo" /> : <div className="cartaz-qrhold">gerando QR…</div>}
        <div className="cartaz-cta">📷 Aponte a câmera do celular no QR<br />e venha caçar o tesouro! 🔥</div>
      </div>

      <div className="cartaz-foot">
        <div>🎪 Cartões escondidos no estande · monte a senha · abra o baú 🎁</div>
        <div className="cartaz-url">{url}</div>
      </div>

      <div className="cartaz-size noprint">
        <button className={size === "A4" ? "on" : ""} onClick={() => setSize("A4")}>A4</button>
        <button className={size === "A3" ? "on" : ""} onClick={() => setSize("A3")}>A3</button>
      </div>
      <button className="btn fire noprint cartaz-print" onClick={() => window.print()}>🖨️ Imprimir ({size})</button>
    </div>
  );
}
