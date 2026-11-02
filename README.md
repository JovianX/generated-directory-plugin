# generated.directory

Publish a built static site to `https://generated.directory/<user>/<app>/`.

This repository is the Cursor plugin. It adds one skill, `generated-directory`, which creates an account, stores an access key, and uploads a built HTML and JavaScript site.

## Install

After the plugin is listed, install **generated-directory** from the Cursor Marketplace, or search for it in Customize.

To try the plugin from this repo before it is listed, copy `plugin/` to `~/.cursor/plugins/local/generated-directory`, then reload Cursor and open Customize.

## Use

Ask Cursor to publish, update, or delete a site on generated.directory. The skill runs `plugin/skills/generated-directory/scripts/publish.mjs`. It does not ask for an account name, email, or password unless you already provided them.

The first publish creates an account. The script prints an account id and an access key once, stores them in `~/.config/generated.directory/credentials.json`, and prints the live URL. Keep that file. The same key publishes, updates, and deletes your apps, and signs you in at [generated.directory/login](https://generated.directory/login).

```bash
GD_ACTION=create GD_SLUG=notes node plugin/skills/generated-directory/scripts/publish.mjs --dir dist
```

A later publish from the same machine replaces the app:

```bash
GD_SLUG=notes node plugin/skills/generated-directory/scripts/publish.mjs --dir dist
```

Pass a name or email only when you already have one:

```bash
GD_ACTION=create GD_USERNAME=ada GD_EMAIL=ada@example.com GD_SLUG=notes \
  node plugin/skills/generated-directory/scripts/publish.mjs --dir dist
```

Restore a saved access key:

```bash
GD_ACTION=login GD_ACCESS_KEY="$GD_ACCESS_KEY" GD_SLUG=notes \
  node plugin/skills/generated-directory/scripts/publish.mjs --dir dist
```

List apps, or delete one after you confirm the slug:

```bash
node plugin/skills/generated-directory/scripts/publish.mjs --list
GD_SLUG=notes node plugin/skills/generated-directory/scripts/publish.mjs --delete
```

The build directory must contain `index.html`. The script checks `dist/`, then `build/`, then `out/`, or the directory you pass with `--dir`. When you do not set a title, it reads `<title>` from `index.html`.

## Configuration

| Name | Purpose |
| --- | --- |
| `GD_API` | API origin. Default `https://upload.generated.directory`. |
| `GD_ACTION` | `create` for a new account, or `login` to store an existing access key. |
| `GD_ACCESS_KEY` | Access key for `GD_ACTION=login`. Pass it only as this environment variable. |
| `GD_USERNAME` | Account id, only when you already chose one. |
| `GD_EMAIL` | Email, only when you already provided one. |
| `GD_SLUG` | App slug. `--slug` does the same thing. |
| `GD_TITLE` | App title. Defaults to the `<title>` in `index.html`. |
| `GD_DIR` | Build directory. `--dir` does the same thing. |

Credentials stay in `~/.config/generated.directory/credentials.json` (`username`, `email` when one was set, and `accessKey`). Do not commit that file.

## Limits

200 files, 20 MB for the app, and 8 MB for one file. Allowed types are html, css, js, json, images, fonts, wasm, txt, and map.

## License

[MIT](LICENSE)
