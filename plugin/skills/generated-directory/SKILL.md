---
name: generated-directory
description: Publishes a built static HTML and JavaScript site to generated.directory/<user>/<app>. Use when the user wants to publish, upload, update, or delete a site on generated.directory, or create a generated.directory account.
---

# Publish to generated.directory

Run `scripts/publish.mjs`. Do not write a new uploader.

## Steps

1. Find the built site. Prefer `dist/`, then `build/`, then `out/`, or a directory the user names. It must contain `index.html` at its root. Read `<title>` from that file when the user does not give a title.
2. Read `~/.config/generated.directory/credentials.json`. It holds `username` (the account id), `email` when one was set, and `accessKey`. That file is the permanent copy of the access key. Do not delete it, and do not copy the key into the repo.
3. If that file is missing, create the account with `GD_ACTION=create`. Do not ask for an account name, email, or password. Pass `GD_USERNAME` or `GD_EMAIL` only when the user already gave them. The script prints an account id and an access key once and stores them. Show both to the user and tell them they can sign in at https://generated.directory/login. The same key publishes, updates, and deletes their apps.
4. If the user already has an access key, restore it with `GD_ACTION=login` and `GD_ACCESS_KEY`. Pass the key only as `GD_ACCESS_KEY`. Never put it in argv, the repo, or logs.
5. If the user wants to sign in on the site and does not have the key, read the credentials file and show them `accessKey`.
6. Ask for an app slug when creating an app. When updating, run the script with `--list` or call `GET /v1/apps` and confirm which slug to replace.
7. To delete an app, run the script with `--delete` and the slug. Confirm with the user before deleting.
8. Run the script. A publish prints `https://generated.directory/<user>/<app>/`.

## Command

Create an account and publish. The API assigns the account id:

```bash
GD_ACTION=create GD_SLUG=notes node scripts/publish.mjs --dir dist
```

Pass a name or email only when the user already supplied one:

```bash
GD_ACTION=create GD_USERNAME=ada GD_EMAIL=ada@example.com GD_SLUG=notes \
  node scripts/publish.mjs --dir dist
```

Restore a saved access key, then publish:

```bash
GD_ACTION=login GD_ACCESS_KEY="$GD_ACCESS_KEY" GD_SLUG=notes \
  node scripts/publish.mjs --dir dist
```

A later publish from the same machine uses the stored access key and replaces the app:

```bash
GD_SLUG=notes node scripts/publish.mjs --dir dist
```

Delete an app:

```bash
GD_SLUG=notes node scripts/publish.mjs --delete
```

`GD_API` overrides the API origin. The default is `https://upload.generated.directory`.

## Limits

200 files, 20 MB for the app, 8 MB for one file. Allowed types are html, css, js, json, images, fonts, wasm, txt, and map. The build must include `index.html`.
