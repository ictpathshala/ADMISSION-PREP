# ভর্তি সহায়িকা — সেটআপ গাইড (১০০% ফ্রি)

স্ট্যাক: **GitHub Pages** (হোস্টিং) + **Firebase Auth + Firestore** (ফ্রি Spark প্ল্যান)।

> ⚠️ ভিডিও/PDF/স্লাইড ফাইল সরাসরি আপলোড হয় না (Firebase Storage-এ এখন বিলিং কার্ড লাগে)।
> ফ্রি সমাধান: ভিডিও **YouTube (Unlisted)** এ, PDF ও স্লাইড **Google Drive/Slides** এ আপলোড করে
> অ্যাডমিন প্যানেলে শুধু লিংক দিন। অ্যাপের ভেতরেই এগুলো প্লে/প্রিভিউ হবে।

## ১. Firebase প্রজেক্ট
1. https://console.firebase.google.com → **Add project** (Analytics বন্ধ রাখতে পারেন)।
2. **Build → Authentication → Get started** → Sign-in method এ **Google** ও **Email/Password** চালু করুন।
3. **Build → Firestore Database → Create database** (production mode, লোকেশন: asia-south1 বা nam5)।
4. Firestore → **Rules** ট্যাবে `firestore.rules` ফাইলের পুরো লেখা পেস্ট করুন। ফাইলের ভেতরে `your-email@gmail.com` বদলে **আপনার Gmail** দিন → **Publish**।
5. **Project settings (⚙️) → Your apps → Web (</>)** → অ্যাপ রেজিস্টার করুন → যে `firebaseConfig` দেখাবে তা `firebase-config.js` এ বসান। একই ফাইলে `ADMIN_EMAILS` এ আপনার Gmail দিন।

## ২. GitHub Pages
1. GitHub এ নতুন repo বানান, এই ফোল্ডারের সব ফাইল আপলোড করুন।
2. Repo → **Settings → Pages** → Source: `Deploy from a branch` → `main` / `(root)` → Save।
3. কিছুক্ষণ পর লিংক পাবেন: `https://USERNAME.github.io/REPO/`
4. Firebase → Authentication → **Settings → Authorized domains** → `USERNAME.github.io` যোগ করুন (নইলে Google লগইন কাজ করবে না)।

## ৩. প্রথমবার ব্যবহার
1. সাইটে গিয়ে **Google দিয়ে অ্যাডমিন Gmail-এ লগইন** করুন → মেনুতে **অ্যাডমিন** আসবে।
2. **কনটেন্ট** ট্যাবে ভিডিও / স্লাইড / PDF আলাদা আলাদা যোগ করুন।
   - YouTube: ভিডিও **Unlisted** করে লিংক দিন।
   - Drive: ফাইল → Share → *Anyone with the link → Viewer* → লিংক কপি।
3. **সাবস্ক্রিপশন ও সেটিংস**: এখন সুইচ **বন্ধ** থাকবে = সব ফ্রি। পরে চালু করলে "ফ্রি" টিক না দেওয়া সব কনটেন্ট লক হবে।
   প্ল্যানের দাম/মেয়াদ ও বিকাশ-নগদ নম্বর এখান থেকেই বদলানো যায়।
4. **পেমেন্ট** ট্যাবে ইউজারের TrxID মিলিয়ে **অনুমোদন** দিলে স্বয়ংক্রিয়ভাবে প্ল্যানের মেয়াদ অনুযায়ী সাবস্ক্রিপশন চালু হবে।

## নিরাপত্তা
- অ্যাডমিন চেনা হয় **ভেরিফায়েড ইমেইল** দিয়ে (Firestore rules এ), তাই শুধু আপনিই কনটেন্ট/পেমেন্ট নিয়ন্ত্রণ করতে পারবেন।
- কনটেন্টের আসল লিংক আলাদা `links` কালেকশনে — নিয়ম অনুযায়ী অনুমতি না থাকলে ডাটাবেস থেকেই দেওয়া হয় না।
- মনে রাখবেন: Drive/YouTube লিংক কেউ জেনে গেলে সেটি শেয়ার করতে পারে; পূর্ণ DRM চাইলে পেইড ভিডিও হোস্টিং লাগবে।

## ফ্রি লিমিট (Firebase Spark)
Firestore: দিনে ৫০ হাজার রিড / ২০ হাজার রাইট। শুরুর জন্য যথেষ্ট।
