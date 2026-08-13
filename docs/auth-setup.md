# BrandRepo Auth Setup

This document captures the required provider-side setup for BrandRepo authentication.

## Implemented App Flows

- Email/password sign up and sign in.
- Required account name during email/password account creation.
- Reset password flow using Supabase recovery emails.
- Google login using Supabase OAuth.
- Pending account name handling for users who create an account with Google.
- Scoped integration tokens for external API/MCP access.

## Required Server Environment Variables

Client/browser Supabase access:

```txt
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

Server-side integration token validation:

```txt
SUPABASE_SECRET_KEY
```

`SUPABASE_SERVICE_ROLE_KEY` is also supported as a fallback name. This value must only be configured on the server/hosting environment. Do not expose it to the browser.

## Integration Token Setup

Integration tokens require database schema and a server-only Supabase key.

### 1. Run the Supabase Schema

Run the latest `supabase/schema.sql` in Supabase SQL Editor.

This creates:

- `public.brandrepo_integration_tokens`
- `public.brandrepo_integration_access_logs`
- indexes for user and token hash lookups
- RLS policies so users can view, create, and revoke only their own tokens
- RLS policies so users can read their own integration access logs

### 2. Add the Vercel Server Secret

In Vercel -> Project -> Settings -> Environment Variables, add:

```txt
SUPABASE_SECRET_KEY
```

Use the Supabase secret/service-role key value. Do not use a publishable key here.

Alternative supported variable name:

```txt
SUPABASE_SERVICE_ROLE_KEY
```

### 3. Redeploy

Redeploy BrandRepo after adding the variable.

### 4. Create a Token

In BrandRepo Settings, create an Integration token and copy it immediately. Use that token as:

```txt
Authorization: Bearer brp_...
```

against:

```txt
https://www.brandrepo.dev/api/mcp
```

## Supabase Auth URL Configuration

Configure these in Supabase Dashboard -> Authentication -> URL Configuration.

### Local Development

Add to Redirect URLs:

```txt
http://localhost:3000/**
```

### Vercel Preview / Temporary Production

Set Site URL while using the Vercel URL:

```txt
https://brandrepo.vercel.app
```

Add to Redirect URLs:

```txt
https://brandrepo.vercel.app/**
```

### Production Domain

After `brandrepo.dev` is connected to Vercel, set Site URL to:

```txt
https://brandrepo.dev
```

Add to Redirect URLs:

```txt
https://brandrepo.dev/**
https://www.brandrepo.dev/**
```

These URLs affect Google login, email confirmation, and password reset links.

## Google OAuth Provider

Configure these in Supabase Dashboard -> Authentication -> Sign In / Providers -> Google.

- Enable Google.
- Paste the Google OAuth Client ID.
- Paste the Google OAuth Client Secret.

The redirect/callback URI in Google Cloud must be the Supabase callback URL:

```txt
https://ejgywrpxtwettkuiuesu.supabase.co/auth/v1/callback
```

If BrandRepo later uses a Supabase custom auth domain, add that callback URI too:

```txt
https://auth.brandrepo.dev/auth/v1/callback
```

## Google Cloud OAuth Client

Configure these in Google Cloud Console -> APIs & Services -> Credentials.

Authorized JavaScript origins:

```txt
http://localhost:3000
https://brandrepo.vercel.app
https://brandrepo.dev
https://www.brandrepo.dev
```

Authorized redirect URIs:

```txt
https://ejgywrpxtwettkuiuesu.supabase.co/auth/v1/callback
```

## Google Consent Screen Branding

Configure these in Google Cloud Console -> APIs & Services -> OAuth consent screen.

- App name: `BrandRepo`
- Application home page: `https://brandrepo.dev`
- Authorized domain: `brandrepo.dev`
- App logo: BrandRepo icon

Google may still show the Supabase project domain during OAuth because the callback runs through Supabase Auth. The cleanest fix is a Supabase custom domain such as `auth.brandrepo.dev`, then updating the app Supabase URL and Google callback URI to use that branded auth domain.
