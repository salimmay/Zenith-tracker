# Privacy Policy for Zenith Tracker

**Last updated:** September 28, 2026

Zenith Tracker ("we", "our", or "us") provides the Zenith Tracker mobile and web applications and the Zenith API service (collectively, the "Service"). This Privacy Policy explains what information we collect, how it is used, and how your privacy is protected.

By using Zenith Tracker, you agree to the collection and use of information in accordance with this policy.

---

## 1. Information We Collect

### A. Information You Provide (Optional Account Registration)
Zenith Tracker is fully functional **without an account** in Guest mode. If you choose to create an account to back up and sync your library across devices, we collect:
- **Account Details:** Your username, email address, and a hashed password (encrypted using industry-standard bcrypt hashing; we never store plain-text passwords).
- **Library & Watch Data:** Shows, movies, seasons, episodes marked as watched, progress timestamps, and custom watchlist entries.

### B. Guest Mode Data (No Account)
If you use Zenith Tracker without creating an account, your watch history and preferences are stored **locally on your device** using local storage / AsyncStorage. This data never touches our account databases unless you explicitly choose to create an account and sync it.

### C. Automatically Collected Technical Data
When communicating with our API server, standard technical information may be logged temporarily for security and rate-limiting purposes:
- IP address (processed temporarily for rate limiting and fraud prevention)
- Device operating system and app version
- Standard timestamp and HTTP request headers

---

## 2. Third-Party Services & Integrations

Zenith Tracker integrates with trusted third-party providers to deliver rich content and functionality:

### A. The Movie Database (TMDB)
- Zenith queries TMDB (`themoviedb.org`) to fetch public metadata, titles, descriptions, episode lists, and poster images.
- We do **not** transmit your personal data, watch history, or email address to TMDB.
- TMDB API is governed by [TMDB Privacy Policy](https://www.themoviedb.org/privacy-policy).

### B. Trakt.tv (Optional)
- If you voluntarily connect your Trakt account, Zenith uses Trakt's secure OAuth device flow to synchronize your watch history.
- You can disconnect your Trakt integration at any time in the app's Settings screen.
- Trakt is governed by [Trakt Privacy Policy](https://trakt.tv/privacy).

### C. Advertising (Google AdMob)
- On mobile platforms (Android and iOS), Zenith displays advertisements via Google Mobile Ads (AdMob) to support the service.
- Google AdMob may use device identifiers (such as the Google Advertising ID) and cookies/SDK telemetry to serve relevant or non-personalized ads according to user consent.
- **User Consent & Privacy Choices:** In compliance with GDPR and Google User Messaging Platform (UMP), European Economic Area (EEA) and UK users are prompted with a consent dialog. You can change your advertising privacy preferences at any time in **Settings → Ad privacy choices**.
- Learn more at [Google's Privacy & Terms](https://policies.google.com/technologies/ads).

---

## 3. How We Use Your Information

We use the collected information solely to:
- Provide, maintain, and personalize your tracking experience.
- Synchronize your watch progress and library across your logged-in devices.
- Prevent abuse, enforce rate limits, and maintain service security.
- Display in-app advertisements through Google AdMob.

We **do not** sell, rent, or trade your personal data to third parties.

---

## 4. Data Storage, Security & Retention

- **Security:** All communication between the app and our API uses encrypted Transport Layer Security (HTTPS / TLS). User passwords are cryptographically salted and hashed.
- **Storage:** Account and library data are securely stored in MongoDB Atlas with encryption at rest and in transit.
- **Retention:** Your account data is retained for as long as your account remains active.

---

## 5. Your Rights & Data Deletion

You have full control over your data:
- **Account Deletion:** You can delete your account and all associated watch history directly within the app under **Settings → Delete Account**, or by contacting us at the email below. Upon deletion, all personal data and library entries are permanently purged from our database.
- **Access and Correction:** You can update your profile information in Settings at any time.

---

## 6. Children's Privacy

Zenith Tracker is not directed at children under the age of 13. We do not knowingly collect personal identifiable information from children under 13. If you believe a child has provided us with personal information, please contact us immediately.

---

## 7. Changes to This Privacy Policy

We may update this Privacy Policy from time to time. Any changes will be posted on this page with an updated "Last updated" date.

---

## 8. Contact Us

If you have any questions, feedback, or requests regarding this Privacy Policy or your data, please contact us at:

- **Developer:** Salim May
- **Email:** salimmay.dev@gmail.com
- **Project Repository:** [https://github.com/salimmay/Zenith-tracker](https://github.com/salimmay/Zenith-tracker)
