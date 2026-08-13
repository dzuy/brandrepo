"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../../../lib/supabase";

type SessionState = "checking" | "signed-out" | "signed-in" | "authorizing" | "error";

function getParam(search: URLSearchParams, key: string) {
  return search.get(key) ?? "";
}

export default function OAuthAuthorizePage() {
  const [sessionState, setSessionState] = useState<SessionState>(supabase ? "checking" : "error");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [userEmail, setUserEmail] = useState("");

  const params = useMemo(() => {
    if (typeof window === "undefined") return new URLSearchParams();
    return new URLSearchParams(window.location.search);
  }, []);

  const authorizationPayload = useMemo(
    () => ({
      response_type: getParam(params, "response_type"),
      client_id: getParam(params, "client_id"),
      redirect_uri: getParam(params, "redirect_uri"),
      scope: getParam(params, "scope"),
      state: getParam(params, "state"),
      code_challenge: getParam(params, "code_challenge"),
      code_challenge_method: getParam(params, "code_challenge_method"),
    }),
    [params],
  );

  useEffect(() => {
    if (!supabase) {
      return;
    }

    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (sessionError) {
        setSessionState("error");
        setError(sessionError.message);
        return;
      }

      const session = data.session;
      if (!session?.access_token) {
        setSessionState("signed-out");
        return;
      }

      setAccessToken(session.access_token);
      setUserEmail(session.user.email ?? "");
      setSessionState("signed-in");
    });
  }, []);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;

    setError("");
    setSessionState("authorizing");
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !data.session?.access_token) {
      setSessionState("signed-out");
      setError(signInError?.message ?? "Unable to sign in.");
      return;
    }

    setAccessToken(data.session.access_token);
    setUserEmail(data.session.user.email ?? "");
    setSessionState("signed-in");
  }

  async function approveConnector() {
    setError("");
    setSessionState("authorizing");

    try {
      const response = await fetch("/api/oauth/authorize/approve", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(authorizationPayload),
      });
      const payload = await response.json();

      if (!response.ok || !payload.redirectUrl) {
        throw new Error(payload.error ?? "Unable to authorize connector.");
      }

      window.location.href = payload.redirectUrl;
    } catch (approveError) {
      setSessionState("signed-in");
      setError(approveError instanceof Error ? approveError.message : "Unable to authorize connector.");
    }
  }

  const requestedScopes = authorizationPayload.scope || "repo:read assets:read";

  return (
    <main className="oauth-page">
      <section className="oauth-card">
        <div>
          <p className="eyebrow">External connector</p>
          <h1>Connect BrandRepo</h1>
          <p className="oauth-subtitle">Allow this connector to read your BrandRepo repos and brand assets.</p>
        </div>

        {!isSupabaseConfigured ? <p className="error-text">Supabase is not configured.</p> : null}
        {sessionState === "checking" ? <p>Checking your BrandRepo session...</p> : null}

        {sessionState === "signed-out" ? (
          <form className="auth-form" onSubmit={signIn}>
            <label>
              Email
              <input autoComplete="email" onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" type="email" value={email} />
            </label>
            <label>
              Password
              <input
                autoComplete="current-password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
                type="password"
                value={password}
              />
            </label>
            <button type="submit">Sign in to continue</button>
          </form>
        ) : null}

        {sessionState === "signed-in" ? (
          <div className="oauth-consent">
            <dl>
              <div>
                <dt>Signed in as</dt>
                <dd>{userEmail}</dd>
              </div>
              <div>
                <dt>Requested access</dt>
                <dd>{requestedScopes}</dd>
              </div>
            </dl>
            <button onClick={approveConnector} type="button">
              Allow access
            </button>
          </div>
        ) : null}

        {sessionState === "authorizing" ? <p>Authorizing connector...</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
      </section>
    </main>
  );
}
