"use client";

import { useEffect, useState, type FormEvent } from "react";
import { getSupabase } from "@/lib/supabase";
import { programacao } from "../data";
import styles from "./painel.module.css";

type Estado = { modo: "auto" | "manual"; hora: string | null };

export default function Painel() {
  const [sb] = useState(() => getSupabase());
  const [pronto, setPronto] = useState(false);
  const [logado, setLogado] = useState(false);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [estado, setEstado] = useState<Estado>({ modo: "auto", hora: null });
  const [salvando, setSalvando] = useState<string | null>(null);

  useEffect(() => {
    if (!sb) {
      setPronto(true);
      return;
    }
    sb.auth.getSession().then(({ data }) => {
      setLogado(Boolean(data.session));
      setPronto(true);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => setLogado(Boolean(session)));
    return () => sub.subscription.unsubscribe();
  }, [sb]);

  useEffect(() => {
    if (!sb || !logado) return;
    sb.from("ao_vivo")
      .select("modo,hora")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setEstado(data as Estado);
      });
    const ch = sb
      .channel("ao_vivo_painel")
      .on("postgres_changes", { event: "*", schema: "public", table: "ao_vivo" }, (p) =>
        setEstado(p.new as Estado),
      )
      .subscribe();
    return () => {
      sb.removeChannel(ch);
    };
  }, [sb, logado]);

  const entrar = async (e: FormEvent) => {
    e.preventDefault();
    if (!sb) return;
    setErro("");
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: senha });
    if (error) setErro("E-mail ou senha inválidos.");
  };

  const definir = async (modo: "auto" | "manual", hora: string | null, chave: string) => {
    if (!sb) return;
    setSalvando(chave);
    await sb.from("ao_vivo").update({ modo, hora, atualizado_em: new Date().toISOString() }).eq("id", 1);
    setSalvando(null);
  };

  if (!sb) {
    return (
      <main className={styles.wrap}>
        <div className={styles.card}>
          <h1 className={styles.h1}>🎭 Painel — Ao vivo</h1>
          <p className={styles.muted}>
            Supabase não configurado neste ambiente. Configure as variáveis do Supabase para usar o controle.
          </p>
        </div>
      </main>
    );
  }

  if (!pronto) {
    return (
      <main className={styles.wrap}>
        <div className={styles.card}>
          <p className={styles.muted}>Carregando…</p>
        </div>
      </main>
    );
  }

  if (!logado) {
    return (
      <main className={styles.wrap}>
        <form className={styles.card} onSubmit={entrar}>
          <h1 className={styles.h1}>🎭 Painel — Ao vivo</h1>
          <p className={styles.muted}>Acesso da equipe. Entre com o login de administrador.</p>
          <input
            className={styles.input}
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
          />
          <input
            className={styles.input}
            type="password"
            placeholder="Senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete="current-password"
          />
          {erro && <p className={styles.erro}>{erro}</p>}
          <button className={styles.btnPrimary} type="submit">
            Entrar
          </button>
        </form>
      </main>
    );
  }

  const atualNoPalco =
    estado.modo === "manual" && estado.hora ? programacao.find((s) => s.hora === estado.hora) : null;

  return (
    <main className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.head}>
          <h1 className={styles.h1}>🎭 Painel — Ao vivo</h1>
          <button className={styles.sair} onClick={() => sb.auth.signOut()}>
            Sair
          </button>
        </div>

        <div className={styles.status}>
          {estado.modo === "auto" ? (
            <>
              🟢 <b>Automático</b> — seguindo os horários previstos.
            </>
          ) : atualNoPalco ? (
            <>
              🔴 <b>No palco:</b> {atualNoPalco.grupo} ({atualNoPalco.hora})
            </>
          ) : (
            <>
              ⏸ <b>Intervalo</b> — ninguém no palco.
            </>
          )}
        </div>

        <div className={styles.row}>
          <button
            className={`${styles.mode} ${estado.modo === "auto" ? styles.on : ""}`}
            disabled={salvando !== null}
            onClick={() => definir("auto", null, "auto")}
          >
            🟢 Automático (relógio)
          </button>
          <button
            className={`${styles.mode} ${estado.modo === "manual" && !estado.hora ? styles.on : ""}`}
            disabled={salvando !== null}
            onClick={() => definir("manual", null, "intervalo")}
          >
            ⏸ Intervalo
          </button>
        </div>

        <p className={styles.muted}>
          Toque na apresentação que está <b>no palco agora</b> (use em caso de atraso):
        </p>
        <ul className={styles.list}>
          {programacao.map((s) => {
            const ativo = estado.modo === "manual" && estado.hora === s.hora;
            return (
              <li key={s.hora}>
                <button
                  className={`${styles.slot} ${ativo ? styles.slotOn : ""}`}
                  disabled={salvando !== null}
                  onClick={() => definir("manual", s.hora, s.hora)}
                >
                  <span className={styles.hora}>{s.hora}</span>
                  <span className={styles.grupo}>
                    {s.grupo}
                    {s.periodo ? ` · ${s.periodo}` : ""}
                  </span>
                  {ativo && <span className={styles.badge}>NO PALCO</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
