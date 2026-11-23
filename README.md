# WasteTech

Waste pickup for homes, hostels and shops around Sunyani, Fiapre, Abesim and Odumase.

- **Request pickup:** chat with Efua, the pickup assistant, or tap a place on the map. Choose bags, a bin or a full aboboyaa load, and general waste or sorted recyclables. Homes and hostels get 10% off and recyclables 25% off. The collector is tracked live to your door and then on to the Disposal Site (Baakoniaba Old Cemetery) or the Recycling Point (Nwawasua IRECOP). You pay in cash or by Mobile Money once disposal is confirmed.
- **My pickups:** your pickup history and receipts, with search and filters.
- **Become a collector:** aboboyaa and tricycle owners apply with a passport photo, licence and plate details.
- **Collector mode:** approved collectors go online and update their location.
- **Admin:** track collectors and where each load was emptied, see pickups per day, approve or reject applications, and see all app accounts.
- **Login:** username and password, using Firebase Authentication.

The app is plain HTML, CSS and JavaScript, with no build step. It uses Firebase for login and data.

> Mobile Money payments are **simulated**. To take real payments, replace `requestMomo()` in `public/js/app.js` with a call to your own payment server (Paystack, Hubtel or the MTN MoMo API). The secret payment keys must never go in this repository.
>
> The five demo collectors (Yaw Mensah and others) stand in only while no approved collector is online.

## Project layout

```
wastetech/
├── public/                  ← the website (everything Firebase Hosting serves)
│   ├── index.html           ← page structure
│   ├── css/style.css        ← all styles, light and dark theme
│   ├── js/app.js            ← the app: map, pickup assistant, pickups, registration, collector mode, admin
│   ├── js/phone.js          ← phone helpers: map dragging, bigger-map button
│   ├── js/firebase.js       ← login screen and database connection
│   ├── js/firebase-config.js← YOUR Firebase project settings (edit this)
├── firestore.rules          ← who can read and write which data
├── firebase.json            ← Firebase Hosting and Firestore settings
└── .firebaserc              ← which Firebase project to deploy to (edit this)
```

## Data stored in Firestore

| Collection | What it holds | Who can read / write |
|---|---|---|
| `users/{uid}` | username, created, last login | that person and admins |
| `admins/{uid}` | marks a person as admin | added by hand in the console |
| `applications/{uid}` | collector applications | the applicant and admins |
| `collectors/{uid}` | approved collectors | everyone logged in reads; admins write |
| `positions/{uid}` | Collector mode check-ins | everyone logged in reads; the collector writes their own |
| `pickups/{uid}` | each customer's pickups and daily counts | that customer and admins |
| `data/users/{uid}/profile` | saved MoMo number | only that person |

Passwords are never stored in Firestore. Firebase Authentication keeps them.

## 1. Put the code on GitHub

**Using the GitHub website (no tools needed):**
1. Go to <https://github.com/new>, name the repository `wastetech`, choose **Private** or **Public**, and click **Create repository**. Don't add a README, because this project already has one.
2. On the new repository page, click **uploading an existing file**.
3. Unzip `wastetech.zip` and drag **everything inside the `wastetech` folder** into the page, including `.gitignore`, `.firebaserc` and the `public` folder. Hidden files that start with a dot may not show in your file manager; turn on "show hidden files" first.
4. Click **Commit changes**.

**Or using Git on your computer** (the zip already contains the Git history):
```bash
cd wastetech
git remote add origin https://github.com/YOUR-USERNAME/wastetech.git
git branch -M main
git push -u origin main
```

## 2. Connect your Firebase project

1. **Turn on login:** Firebase console → your project → **Authentication** → **Get started** → **Sign-in method** → **Email/Password** → **Enable** → **Save**.
2. **Create the database:** **Firestore Database** → **Create database** → pick a location (for example `europe-west1`) → **production mode**.
3. **Copy your settings:** ⚙️ **Project settings** → **General** → **Your apps** → click the **`</>`** (web) icon → register the app → copy the `firebaseConfig` values into `public/js/firebase-config.js`.
4. **Set your project ID:** in `.firebaserc`, replace `your-project-id` with your project ID (shown under Project settings → General).

The settings in `firebase-config.js` are not secret. It's normal for them to be on GitHub. What protects the data is `firestore.rules`.

## 3. Publish the app (Firebase Hosting)

You need [Node.js](https://nodejs.org) installed. Then, in the `wastetech` folder:

```bash
npm install -g firebase-tools     # once
firebase login                    # once; opens your browser
firebase deploy                   # uploads the website and the database rules
```

The app is then live at `https://YOUR-PROJECT-ID.web.app`.

To try it on your own computer first, run `firebase serve` and open <http://localhost:5000>.

## 4. Make yourself admin

1. Open the live app and **Create an account** with your username and password.
2. Firebase console → **Authentication** → **Users**, and copy your **User UID**.
3. **Firestore Database** → **Start collection** → name it `admins` → set the **Document ID** to your User UID → add any field (for example `role` = `owner`) → **Save**.
4. Reload the app. The **Admin** tab appears.

Repeat this for anyone else who should manage collectors.

## How login works

- People sign up and log in with a **username and password**. Firebase needs an email address, so the app turns `kwame_a` into `kwame_a@users.wastetech.app` behind the scenes (`USERNAME_DOMAIN` in `firebase-config.js`). No email is ever sent there. Keep that setting the same once people have signed up.
- Usernames are unique: two people can't take the same one.
- **"Keep me logged in on this device"** keeps people logged in after the browser closes. Without it, they're logged out when the browser closes.
- Firebase slows down repeated wrong passwords on its own.
- **Forgotten passwords:** because there's no real email, Firebase can't send a reset link. An admin deletes the person's account in **Authentication → Users**, and the person signs up again. Their old pickup history and application stay under the old account. To let people reset their own password, change sign-up to ask for a real email and add Firebase's `sendPasswordResetEmail`.

## Updating the app

Edit the files, then:

```bash
git add -A
git commit -m "Describe your change"
git push
firebase deploy
```
