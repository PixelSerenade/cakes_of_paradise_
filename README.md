# Cakes_of_Paradise
Cakes of Paradise is a cake storefront with a customer frontend and a Node.js, Express.js, and MongoDB backend. It includes customer/admin authentication, a searchable cake catalogue, order checkout and tracking, Razorpay payments, customer reviews, allergen notes, and an admin order dashboard.

## Run locally

1. Install dependencies with `cd backend` then `npm install`.
2. Copy `backend/.env.example` to `backend/.env` and set a MongoDB connection string, a long random `JWT_SECRET`, unique admin credentials, and Razorpay test keys. Configure Razorpay automatic payment capture and set a webhook URL to `/api/payments/razorpay/webhook` with `payment.captured` and `order.paid` events. Use live keys only after testing the complete checkout flow.
3. Start the site and API with `npm start` from `backend`. Open `http://localhost:5000`.
4. Create or update the administrator with `npm run seed:admin` from `backend`.

For a static S3 frontend, deploy the Express backend separately and set `window.CAKES_API_BASE` in `api-config.js` to the backend's public HTTPS API URL ending in `/api` (for example, `https://your-backend.example.com/api`). The default `/api` value is for the local setup where Express serves both the site and API. The backend must allow requests from the S3 website origin.

Six responsive bakery email templates are sent from backend events: account registration, newsletter opt-in, order creation, successful payment, admin status changed to **Shipped**, and custom cake enquiry submission. The templates share the cream, dusty pink, sage and powder blue Cakes of Paradise style and include order, payment, tracking and enquiry details. SMTP is supported through `BREVO_SMTP_*` or `SMTP_*` settings; the existing Gmail app-password and Resend settings are also supported. Set a verified sender in `EMAIL_FROM` (or `ORDER_EMAIL_FROM`), the deployed site URL in `PUBLIC_SITE_URL`, and—when the API is hosted separately—the backend API URL in `PUBLIC_API_URL`. Keep all provider credentials in `backend/.env`; never put them in frontend configuration. See `backend/.env.example` for the variable names. A newsletter address is saved only after the visitor checks the email-consent box, and each newsletter welcome includes a working unsubscribe link. Delivery errors are logged without rolling back orders or account creation; order email status fields record the outcome. Orders and tracking remain available in the customer account if delivery is unavailable. The catalogue photos are served from the project image library. Allergen labels are indicative; customers should confirm ingredients and cross-contact details with the bakery.

WhatsApp notifications are optional. Configure Meta WhatsApp Cloud API credentials and a pre-approved message template in `backend/.env`; the template body should accept customer name, order number, status, and delivery date. Email and WhatsApp delivery require the bakery's service accounts and are best-effort, so notification provider failures do not block orders.

The API test script (`npm test` from `backend`) requires the server to be running and the configured admin account to exist. It creates a temporary customer account in the configured database.

## Current features

- Search and filter cake options, flavours, sizes, and indicative allergen information.
- Sign in to order, pay online through Razorpay or choose pay at the bakery, and follow status updates.
- Admin users can review orders and update preparation and delivery status.
- Customers can review a cake after an order containing it has been marked completed.
- Staff can manage catalogue photos, prices, flavours, sizes, availability, and verified dietary tags from the admin dashboard. Dietary tags are empty until bakery staff confirm recipes and cross-contact practices.
- Customers can apply discount codes and gift cards during checkout. Staff can create offers and issue gift certificates; a gift card's code is shown only once when issued.
- The admin dashboard includes paid revenue, popular cakes, upcoming deliveries, and review summaries.
- Delivery is free for Surathkal PIN 575014 and for bakery pickup. Starter outside-Surathkal fee bands are ₹40 up to 5 km, ₹70 for 5–10 km, ₹100 for 10–15 km, and ₹130 for 15–20 km. At checkout, customers enter their PIN and the app automatically estimates driving distance between the PIN-area centres, displays that estimate and fee, and recalculates it on the server when placing the order. The bakery origin defaults to 575014; set `BAKERY_PINCODE` and a `MAPPLS_API_KEY` with geocoding and routing access in `backend/.env`. Mappls API keys are required for automatic quotes outside the origin PIN, and outages/key setup issues prevent outside-area checkout. Admins can change or pause fee bands. Distances above the configured range require a further fee band or pickup.
- Customer accounts save up to 10 delivery addresses, favourite cakes, and past order details for reorder. Completed, paid orders earn 1 point per ₹100 after discounts; 1 point is worth ₹1 and checkout caps redemption at 20% of the discounted cake subtotal.
- Customers can opt in to birthday and anniversary email reminders; only the month and day are stored. A valid existing customer's referral code gives the new customer 50 points and the referrer 100 points after the new customer's first order is paid and completed. Referral point awards can be adjusted by an admin. Email reminders require a Resend key and verified sender address.
- Customers can cancel before preparation begins. Gift card and reward point value is restored; paid cash/online refunds appear in the admin dashboard. Razorpay refunds are submitted server-side and can be finalized through the configured `refund.processed` and `refund.failed` webhook events; offline refunds are recorded by bakery staff after they send the money back.
- Gift card balance lookup displays issue, redemption, and refund history. Admin sales reports accept custom date ranges for seasonal or festival comparisons.
