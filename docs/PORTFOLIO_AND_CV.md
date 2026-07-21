# Wali Rapports — CV, portfolio & social copy

Ready-to-use text for résumés, LinkedIn, GitHub, interviews, and posts.  
Adapt names/dates; keep claims accurate to what you personally shipped.

Live product: **https://cabinet.wilaya-tlemcen.dz**

---

## One-line pitch

**EN:** Spec-driven full-stack platform that digitizes the Wilaya cabinet’s official rapports — from attaché drafting to Chef validation and Wali decision — with versioning, bilingual RTL UI, exports, and push notifications.

**FR:** Plateforme full-stack pilotée par spécifications qui digitalise les rapports officiels du cabinet du Wali — de la rédaction par les attachés à la validation du Chef puis à la décision du Wali — avec versions, UI bilingue RTL, exports et notifications push.

**AR:** منصة رقمية متكاملة لإدارة التقارير الرسمية لديوان الوالي — من إعداد الملحقين إلى مصادقة رئيس الديوان ثم قرار السيد الوالي — مع الإصدارات، واجهة عربية RTL، التصدير، والإشعارات.

---

## CV bullets (English) — pick 4–6

- Designed and shipped a **production government workflow app** for Wilaya Tlemcen cabinet: multi-role rapports (Admin, Attaché, Chef de cabinet, Wali) replacing Excel/Word handoffs.
- Built an **end-to-end review pipeline** (draft → Chef gate → Wali inbox → accept / request changes) with **immutable version snapshots** and audit-friendly history.
- Implemented **service-level ACL sharing** (`view` / `manage`) so several attachés collaborate on the same domain with consistent lists, badges, and notification fan-out.
- Delivered **four rapport content kinds** (data tables, rich TipTap documents, shared fiches, configurable commune/daira/direction lists) with schema-driven forms.
- Developed **bilingual AR/FR, RTL-first** React UI with Zod validation on client and server for create/edit flows.
- Added **PDF / Word / Excel export** with Arabic typography and layout rules suitable for official documents.
- Integrated **Web Push + in-app notifications** (prefs, Chef/Wali pending, feedback, discussion, calendar digests) without polling.
- Practiced **spec-first engineering**: canonical docs under `spec/`, then Express/Sequelize/PostgreSQL API and React SPA aligned to the same contracts.
- Packaged and deployed to **cPanel Node.js (Passenger)** + static SPA hosting with reproducible zip pipelines (`package-deploy.ps1`).

---

## CV bullets (Français)

- Conception et mise en production d’une **application métier gouvernementale** pour le cabinet de la Wilaya de Tlemcen : rapports multi-rôles (Admin, Attaché, Chef, Wali).
- Pipeline de validation complet (brouillon → gate Chef → inbox Wali → acceptation / demande de modification) avec **versions immuables**.
- Partage de domaines (**ACL view/manage**) entre attachés : listes, compteurs et notifications cohérents.
- Quatre types de contenu (tableaux, documents riches TipTap, fiches partagées, listes commune/daïra/direction) + export PDF/Word/Excel.
- UI **bilingue AR/FR, RTL-first**, validation Zod client/serveur, notifications Web Push.
- Déploiement cPanel (Node.js App + `public_html`) via packaging automatisé.

---

## CV bullets (العربية)

- تطوير ونشر منصة حكومية لإدارة تقارير ديوان والي ولاية تلمسان (أدوار: مدير، ملحق، رئيس الديوان، والي).
- مسار اعتماد كامل مع أرشفة الإصدارات ومسار Chef ثم الوالي.
- مشاركة مجالات المتابعة بين الملحقين مع صلاحيات عرض/تحرير وإشعارات موحّدة.
- أربعة أنواع محتوى (جداول، وثائق غنية، بطاقات قراءة مشتركة، قوائم بلديات/دوائر/مديريات) وتصدير PDF/Word/Excel.
- واجهة عربية/فرنسية RTL، تحقق Zod، إشعارات Web Push.
- نشر على استضافة cPanel مع حزم نشر قابلة للتكرار.

---

## Portfolio project card

**Title:** Wali Rapports — Wilaya Cabinet Reporting Platform  

**Role:** Full-stack developer (product + backend + frontend + deploy)  

**Context:** Real operational tool for a governor’s office cabinet (not a demo toy).  

**Problem:** Official états/rapports lived in scattered Excel/Word files; slow handoffs, weak traceability, no shared ACL or version archive.  

**Solution:** Spec-driven web app with role-based workflows, rich editors, exports, push alerts, and Chef→Wali validation.  

**Impact (talking points):**
- Single source of truth for cabinet rapports and decisions  
- Faster Chef/Wali review loops with clear statuses and badges  
- Shared domains without losing access control  
- Official-ready exports and bilingual RTL UX for Algerian public administration  

**Stack:** React, TypeScript, Vite, TipTap, TanStack Query · Node.js, Express, Sequelize, PostgreSQL · JWT auth · Zod · Web Push · PDF/Word/Excel  

**Link:** https://cabinet.wilaya-tlemcen.dz  

---

## LinkedIn / post snippets

### Short (EN)

Shipped **Wali Rapports** for Wilaya Tlemcen’s cabinet: a full-stack platform that turns Excel/Word chaos into a controlled workflow — attachés draft, Chef validates, Wali decides — with versioning, RTL bilingual UI, exports, and push notifications.  
Live: cabinet.wilaya-tlemcen.dz

### Short (FR)

Livraison de **Wali Rapports** pour le cabinet de la Wilaya de Tlemcen : une plateforme full-stack qui remplace le chaos Excel/Word par un circuit maîtrisé — rédaction, validation Chef, décision du Wali — avec versions, UI bilingue RTL, exports et notifications push.

### Longer story (EN)

Government software fails when it ignores real hierarchy and paper habits. On **Wali Rapports**, I modeled the cabinet’s real chain of command: attachés work inside granted domains, the Chef de cabinet gates first submissions, and the Wali reviews with a clear inbox and decision trail.  

Under the hood: React + Express + PostgreSQL, TipTap rich docs, schema-driven tables and commune lists, service sharing ACLs, Web Push, and PDF/Word/Excel exports tuned for Arabic RTL. Specs first, then code — so product rules stay auditable.  

Proud this runs in production for day-to-day cabinet work.

### Hashtags (optional)

`#FullStack` `#GovTech` `#React` `#NodeJS` `#PostgreSQL` `#RTL` `#PublicSector` `#Algeria` `#ProductEngineering`

---

## Interview talking points

1. **Spec-first:** How writing `spec/` modules reduced ambiguity before coding roles, statuses, and notifications.  
2. **Role matrix:** Why Chef gate exists, when bypass happens after Wali change requests, and how that protects the Wali inbox.  
3. **ACL sharing:** Difference between “see the service in the tree” and “see every rapport in that service” — and how grant-scoped lists/counts/notifications stay aligned.  
4. **Versioning:** Snapshots on submit so history/graphs/archives stay immutable when office edits after feedback.  
5. **RTL + bilingual:** Hard parts of Arabic PDF/Word tables and TipTap alignment in an RTL shell.  
6. **Deploy constraints:** Building static SPA + Node on shared cPanel, env separation, migrations without overwriting production secrets.

---

## Skills to list (aligned to this project)

React · TypeScript · Node.js · Express · PostgreSQL · Sequelize · REST APIs · JWT / session cookies · Zod validation · TanStack Query · TipTap · i18n / RTL · Web Push · PDF/Word/Excel generation · Role-based access control · Spec-driven development · cPanel / Node hosting deploy

---

## Honesty note

Only claim features **you** implemented or owned. If work was collaborative, say “led / owned X” or “contributed to Y.” Prefer measurable process outcomes (workflow clarity, production use) over inflated metrics you cannot prove.
