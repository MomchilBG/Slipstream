# Slipstream

Slipstream is a bicycle-focused discussion forum: users register, create posts (with tags and up to 5 images), comment and reply on any post, upvote/downvote posts and comments, bookmark posts, earn badges, and get notified when someone replies to or mentions them. Admins can search users, block/unblock accounts, and moderate posts, tags, and comments.

Built with **React + TypeScript + Vite** on the frontend and **Supabase** (Postgres, Auth, Storage, Row Level Security) as the backing store.

## Tech stack

- **React 19** + **React Router 7** (client-side routing, route guards for auth/admin-only pages)
- **TypeScript**, strict mode
- **Vite** for dev server and production builds
- **Supabase** (`@supabase/supabase-js`) for authentication, the Postgres database, and file storage (avatars, post images)
- **Vitest** + **React Testing Library** for tests, run under jsdom
- **ESLint** (flat config, `typescript-eslint`, `eslint-plugin-react-hooks`) for linting

## Getting started

The app lives in the `slipstream/` subdirectory — run all commands from there:

```
cd slipstream
npm install
cp .env.example .env.local   # then fill in your Supabase project's URL and publishable key
npm run dev
```

`.env.local` needs:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

The database schema lives in `supabase/migrations/` as a sequence of numbered SQL files; apply them (in order) to a Supabase project to stand up the tables, RLS policies, triggers, and Storage buckets the app expects, then point `.env.local` at that project.

### Scripts

| Command              | Description                                           |
| -------------------- | ----------------------------------------------------- |
| `npm run dev`        | Start the Vite dev server                             |
| `npm run build`      | Type-check (`tsc -b`) then produce a production build |
| `npm run lint`       | Run ESLint over the project                           |
| `npm run preview`    | Preview the production build locally                  |
| `npm run test`       | Run the Vitest suite once (used before committing)    |
| `npm run test:watch` | Run Vitest in watch mode for local iteration          |

## Features

- **Auth**: Supabase Auth is the system of record for login/session state (no custom auth entity). Registration collects first/last name, email, and an immutable username; login accepts either a username or email. Users can edit their profile (name, bio, avatar with an in-browser cropper), change their password, or delete their account entirely (which also cleans up their uploaded files).
- **Posts**: title, content, up to 5 uploaded images, and lowercase deduplicated tags. Authors can edit or delete their own posts; tags are editable after creation.
- **Comments**: threaded one level deep (replies to replies stay flat under the original top-level comment), with `@mention` support. Deleting a comment soft-deletes it (`[deleted]` placeholder) so thread structure is preserved.
- **Voting**: one upvote or downvote per user per post/comment, driving `like_count`/`dislike_count` and the author's reputation automatically via database triggers. Voting on your own content is blocked.
- **Bookmarks**: any signed-in user can save/unsave a post for later, from a per-user saved-posts list on their profile.
- **Badges**: auto-awarded on milestones (post count, comment count, reputation, tenure), shown next to usernames everywhere and with progress bars toward the next tier on each user's public profile.
- **Notifications**: a bell in the navbar surfaces new-comment, reply, and @mention notifications, each linking straight to the relevant comment.
- **Search/browse**: a navbar search bar parses `#tag`, plain words, and `u/username` tokens to filter/search posts, tags, or users, with sort and pagination.
- **Admin**: a dedicated `/admin` section (separate from the rest of the app) lets admins search users, block/unblock accounts, delete any post, and remove tags or comments from any post.
- **Light/dark theme** toggle, persisted and applied via CSS custom properties.

See `CLAUDE.md` for detailed, up-to-date implementation notes (architecture decisions, gotchas, and rationale) intended for AI coding assistants working on this codebase.

## Project structure

```
slipstream/
├── src/
│   ├── auth/          # AuthProvider/AuthContext wrapping Supabase auth
│   ├── components/    # Shared UI: Navbar, PostForm, ConfirmDialog, RequireAuth/RequireAdmin, ...
│   ├── lib/            # Supabase-backed data access (posts, comments, tags, votes, badges, ...)
│   ├── pages/          # Routed pages: Home, Login, Register, Profile, PostView, Admin, ...
│   ├── theme/          # Light/dark theme toggle
│   └── test/           # Supabase mock, provider-wrapped render helpers, jsdom setup
└── supabase/
    └── migrations/     # Numbered SQL migrations: schema, RLS policies, triggers, Storage buckets
```

Tests are co-located with the source they cover (`*.test.ts`/`*.test.tsx` next to e.g. `src/lib/posts.ts` or `src/pages/Login/Login.tsx`) rather than in a separate `__tests__` tree.
