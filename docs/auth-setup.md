# BrandRepo Auth Setup

This document captures the required provider-side setup for BrandRepo authentication.

## Implemented App Flows

- Email/password sign up and sign in.
- Required account name during email/password account creation.
- Reset password flow using Supabase recovery emails.
- Google login using Supabase OAuth.
- Pending account name handling for users who create an account with Google.

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
