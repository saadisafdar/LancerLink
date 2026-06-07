import os
import sys
import json
import sqlite3
import unittest
from datetime import datetime

# Configure server to use verification database BEFORE importing server
import server
server.DATABASE = "test_verify.db"

class TestLancerLinkAPI(unittest.TestCase):
    def setUp(self):
        # Remove old test DB if exists
        if os.path.exists("test_verify.db"):
            try:
                os.remove("test_verify.db")
            except OSError:
                pass
        
        # Initialize test DB
        server.init_db()
        self.app = server.app.test_client()
        self.app.testing = True

    def tearDown(self):
        # Clean up database connection
        if os.path.exists("test_verify.db"):
            try:
                os.remove("test_verify.db")
            except OSError:
                pass

    def test_complete_workflow(self):
        print("\n--- Running LancerLink Verification Tests ---")

        # ----------------------------------------------------
        # 1. Registration
        # ----------------------------------------------------
        reg_payload = {
            "name": "Bob Freelancer",
            "email": "bob@lancerlink.co",
            "password": "password123",
            "role": "freelancer"
        }
        res = self.app.post("/api/auth/register", json=reg_payload)
        self.assertEqual(res.status_code, 201)
        data = json.loads(res.data)
        self.assertTrue(data["success"])
        self.assertEqual(data["data"]["user"]["email"], "bob@lancerlink.co")
        bob_csrf = data["data"]["csrf_token"]
        self.assertTrue(bob_csrf)
        print("[PASS] User registration & session setup")

        # Log out
        res = self.app.post("/api/auth/logout")
        self.assertEqual(res.status_code, 200)

        # ----------------------------------------------------
        # 2. Login & Session Restoration
        # ----------------------------------------------------
        login_payload = {
            "email": "jane@lancerlink.co",
            "password": "password123",
            "role": "client"
        }
        res = self.app.post("/api/auth/login", json=login_payload)
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        self.assertTrue(data["success"])
        jane_csrf = data["data"]["csrf_token"]
        self.assertEqual(data["data"]["user"]["name"], "Jane Cooper")
        print("[PASS] User login & session setup")

        # Restore session / GET /api/auth/me
        res = self.app.get("/api/auth/me")
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        self.assertTrue(data["success"])
        self.assertEqual(data["data"]["user"]["role"], "client")
        print("[PASS] Session restoration")

        # ----------------------------------------------------
        # 3. CSRF Rejection
        # ----------------------------------------------------
        proj_payload = {
            "title": "CSRF Vulnerability Test Project",
            "description": "This project should fail to post due to missing CSRF token header.",
            "category": "Web Development",
            "budget": 500
        }
        # Attempt state change without X-CSRF-Token header
        res = self.app.post("/api/projects", json=proj_payload)
        self.assertEqual(res.status_code, 403)
        data = json.loads(res.data)
        self.assertFalse(data["success"])
        self.assertIn("CSRF", data["error"])
        print("[PASS] CSRF rejection on state-changing requests")

        # ----------------------------------------------------
        # 4. Unauthorized Role Rejection
        # ----------------------------------------------------
        # Jane (client) logs out, Alex (freelancer) logs in
        self.app.post("/api/auth/logout")
        login_alex = {
            "email": "alex@lancerlink.co",
            "password": "password123",
            "role": "freelancer"
        }
        res = self.app.post("/api/auth/login", json=login_alex)
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        alex_csrf = data["data"]["csrf_token"]

        # Alex tries to create a project (Client only endpoint)
        headers = {"X-CSRF-Token": alex_csrf}
        res = self.app.post("/api/projects", json=proj_payload, headers=headers)
        self.assertEqual(res.status_code, 403)
        data = json.loads(res.data)
        self.assertFalse(data["success"])
        self.assertEqual(data["error"], "Only clients can post contracts")
        print("[PASS] Role-based endpoint authorization")

        # ----------------------------------------------------
        # 5. Project Creation (Authorized Client)
        # ----------------------------------------------------
        # Log back as Jane
        self.app.post("/api/auth/logout")
        res = self.app.post("/api/auth/login", json=login_payload)
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        jane_csrf = data["data"]["csrf_token"]

        headers_jane = {"X-CSRF-Token": jane_csrf}
        proj_payload = {
            "title": "Verifiable Machine Learning Pipeline API",
            "description": "Construct a secure, self-documenting REST API in Python using FastAPI.",
            "category": "Web Development",
            "budget": 1000.00
        }
        res = self.app.post("/api/projects", json=proj_payload, headers=headers_jane)
        self.assertEqual(res.status_code, 201)
        data = json.loads(res.data)
        self.assertTrue(data["success"])
        project_id = data["data"]["project"]["id"]
        self.assertEqual(data["data"]["project"]["budget_cents"], 100000) # 1000 USD * 100
        print("[PASS] Project creation & budget-to-cents parsing")

        # ----------------------------------------------------
        # 6. Bid Submission
        # ----------------------------------------------------
        # Log out Jane, log in Alex (freelancer)
        self.app.post("/api/auth/logout")
        res = self.app.post("/api/auth/login", json=login_alex)
        data = json.loads(res.data)
        alex_csrf = data["data"]["csrf_token"]
        headers_alex = {"X-CSRF-Token": alex_csrf}

        # Alex bids on Jane's project
        bid_payload = {
            "amount": 900.00,
            "timeline": "3 Days",
            "pitch": "I can build your secure REST API with proper database joins."
        }
        res = self.app.post(f"/api/projects/{project_id}/bids", json=bid_payload, headers=headers_alex)
        self.assertEqual(res.status_code, 201)
        data = json.loads(res.data)
        self.assertTrue(data["success"])
        bid_id = data["data"]["bid"]["id"]
        self.assertEqual(data["data"]["bid"]["amount_cents"], 90000)
        print("[PASS] Bid submission")

        # ----------------------------------------------------
        # 7. Insufficient Wallet Balance for Awarding
        # ----------------------------------------------------
        # Log back in as Jane (client)
        self.app.post("/api/auth/logout")
        res = self.app.post("/api/auth/login", json=login_payload)
        data = json.loads(res.data)
        jane_csrf = data["data"]["csrf_token"]
        headers_jane = {"X-CSRF-Token": jane_csrf}

        # Verify Jane has $3500. Let's make wallet $500 temporarily to trigger insufficient balance
        conn = sqlite3.connect("test_verify.db")
        conn.execute("UPDATE users SET wallet_cents = 50000 WHERE id = 'usr_client_jane'") # $500
        conn.commit()
        conn.close()

        # Jane attempts to award project ($900) while having $500
        res = self.app.post(f"/api/bids/{bid_id}/award", headers=headers_jane)
        self.assertEqual(res.status_code, 409)
        data = json.loads(res.data)
        self.assertFalse(data["success"])
        self.assertEqual(data["error"], "Insufficient balance in virtual wallet to lock escrow")
        print("[PASS] Insufficient wallet balance verification")

        # ----------------------------------------------------
        # 8. Bid Awarding (Atomic Escrow Transaction)
        # ----------------------------------------------------
        # Add virtual deposit to Jane's wallet
        dep_res = self.app.post("/api/wallet/deposit", json={"amount": 1000.00}, headers=headers_jane) # deposit $1000 (total wallet becomes $1500)
        self.assertEqual(dep_res.status_code, 200)

        # Jane awards contract
        res = self.app.post(f"/api/bids/{bid_id}/award", headers=headers_jane)
        self.assertEqual(res.status_code, 200)

        # Verify wallet states inside SQLite database
        conn = sqlite3.connect("test_verify.db")
        conn.row_factory = sqlite3.Row
        client_row = conn.execute("SELECT wallet_cents FROM users WHERE id = 'usr_client_jane'").fetchone()
        project_row = conn.execute("SELECT status, escrow_cents, hired_freelancer_id FROM projects WHERE id = ?", (project_id,)).fetchone()
        conn.close()

        # Jane had $1500, bid was $900. Wallet must be exactly $600. Project escrow must be $900.
        self.assertEqual(client_row[0], 60000) # $600.00
        self.assertEqual(project_row["status"], "hired")
        self.assertEqual(project_row["escrow_cents"], 90000)
        self.assertEqual(project_row["hired_freelancer_id"], "usr_free_alex")
        print("[PASS] Atomic bid awarding & escrow lock transaction")

        # ----------------------------------------------------
        # 9. Prevent Duplicate Awarding
        # ----------------------------------------------------
        # Awarding again should fail because status is no longer 'open'
        res = self.app.post(f"/api/bids/{bid_id}/award", headers=headers_jane)
        self.assertEqual(res.status_code, 409)
        data = json.loads(res.data)
        self.assertFalse(data["success"])
        self.assertEqual(data["error"], "Project is not open for awarding")
        print("[PASS] Duplicate award prevention")

        # ----------------------------------------------------
        # 10. Messaging Access Controls
        # ----------------------------------------------------
        # Alex (hired) can send message
        self.app.post("/api/auth/logout")
        res = self.app.post("/api/auth/login", json=login_alex)
        alex_csrf = json.loads(res.data)["data"]["csrf_token"]
        headers_alex = {"X-CSRF-Token": alex_csrf}
        msg_payload = {"freelancer_id": "usr_free_alex", "body": "Hey Jane, starting work now."}
        res = self.app.post(f"/api/projects/{project_id}/messages", json=msg_payload, headers=headers_alex)
        self.assertEqual(res.status_code, 201)

        # Log in as Sarah (unrelated freelancer)
        self.app.post("/api/auth/logout")
        login_sarah = {"email": "sarah@lancerlink.co", "password": "password123", "role": "freelancer"}
        res = self.app.post("/api/auth/login", json=login_sarah)
        sarah_csrf = json.loads(res.data)["data"]["csrf_token"]
        headers_sarah = {"X-CSRF-Token": sarah_csrf}

        # Sarah tries to view messages for Jane & Alex's project
        res = self.app.get(f"/api/projects/{project_id}/messages?freelancer_id=usr_free_alex", headers=headers_sarah)
        self.assertEqual(res.status_code, 403)
        print("[PASS] Messaging access permission rules")

        # ----------------------------------------------------
        # 11. Deliverable Submission
        # ----------------------------------------------------
        # Log back as Alex
        self.app.post("/api/auth/logout")
        res = self.app.post("/api/auth/login", json=login_alex)
        alex_csrf = json.loads(res.data)["data"]["csrf_token"]
        headers_alex = {"X-CSRF-Token": alex_csrf}
        
        deliv_payload = {
            "filename": "machine_learning_pipeline.zip",
            "comment": "Final models and endpoints fully documented and tested."
        }
        res = self.app.post(f"/api/projects/{project_id}/submit-work", json=deliv_payload, headers=headers_alex)
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        self.assertEqual(data["data"]["project"]["status"], "submitted")
        print("[PASS] Work deliverable submission")

        # ----------------------------------------------------
        # 12. Client Revision Request
        # ----------------------------------------------------
        # Log back as Jane
        self.app.post("/api/auth/logout")
        res = self.app.post("/api/auth/login", json=login_payload)
        jane_csrf = json.loads(res.data)["data"]["csrf_token"]
        headers_jane = {"X-CSRF-Token": jane_csrf}
        
        rev_payload = {
            "revision_note": "Please update formatting parameters to match JSON specifications exactly."
        }
        res = self.app.post(f"/api/projects/{project_id}/request-revision", json=rev_payload, headers=headers_jane)
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        self.assertEqual(data["data"]["project"]["status"], "revision_requested")
        self.assertEqual(data["data"]["project"]["revision_note"], rev_payload["revision_note"])
        print("[PASS] Revision request flow")

        # ----------------------------------------------------
        # 13. Deliverable Resubmission
        # ----------------------------------------------------
        # Log back as Alex
        self.app.post("/api/auth/logout")
        res = self.app.post("/api/auth/login", json=login_alex)
        alex_csrf = json.loads(res.data)["data"]["csrf_token"]
        headers_alex = {"X-CSRF-Token": alex_csrf}
        
        deliv_payload2 = {
            "filename": "machine_learning_pipeline_v2.zip",
            "comment": "Formatting parameters corrected as requested."
        }
        res = self.app.post(f"/api/projects/{project_id}/submit-work", json=deliv_payload2, headers=headers_alex)
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        self.assertEqual(data["data"]["project"]["status"], "submitted")
        self.assertIsNone(data["data"]["project"]["revision_note"]) # Cleared notes
        print("[PASS] Resubmission & revision note clear")

        # ----------------------------------------------------
        # 14. Acceptance & Payment Release
        # ----------------------------------------------------
        # Log back as Jane
        self.app.post("/api/auth/logout")
        res = self.app.post("/api/auth/login", json=login_payload)
        jane_csrf = json.loads(res.data)["data"]["csrf_token"]
        headers_jane = {"X-CSRF-Token": jane_csrf}

        # Accept work and trigger payment release
        res = self.app.post(f"/api/projects/{project_id}/accept-work", headers=headers_jane)
        self.assertEqual(res.status_code, 200)

        # Verify database wallet balances
        conn = sqlite3.connect("test_verify.db")
        conn.row_factory = sqlite3.Row
        alex_row = conn.execute("SELECT wallet_cents FROM users WHERE id = 'usr_free_alex'").fetchone()
        project_row = conn.execute("SELECT status, escrow_cents FROM projects WHERE id = ?", (project_id,)).fetchone()
        conn.close()

        # Alex starting wallet $850. Received $900. Total wallet must be $1750 (175000 cents). Escrow = 0.
        self.assertEqual(alex_row[0], 175000)
        self.assertEqual(project_row["status"], "completed")
        self.assertEqual(project_row["escrow_cents"], 0)
        print("[PASS] Escrow release transaction (credited freelancer, zeroed escrow)")

        # ----------------------------------------------------
        # 15. Prevent Duplicate Payment Release
        # ----------------------------------------------------
        res = self.app.post(f"/api/projects/{project_id}/accept-work", headers=headers_jane)
        self.assertEqual(res.status_code, 409)
        data = json.loads(res.data)
        self.assertFalse(data["success"])
        self.assertEqual(data["error"], "Duplicate payment release prevention triggered: No locked escrow found")
        print("[PASS] Duplicate payment release prevention")

        # ----------------------------------------------------
        # 16. Double-Blind Review Rules
        # ----------------------------------------------------
        # Jane reviews Alex
        review_payload = {
            "rating": 5,
            "comment": "Excellent work. Fast API meets all requirements."
        }
        res = self.app.post(f"/api/projects/{project_id}/reviews", json=review_payload, headers=headers_jane)
        self.assertEqual(res.status_code, 201)

        # Client tries duplicate review
        res = self.app.post(f"/api/projects/{project_id}/reviews", json=review_payload, headers=headers_jane)
        self.assertEqual(res.status_code, 409)
        print("[PASS] Review submission & duplicate protection")

        # Get reviews as Jane -> returns Jane's review but NOT Alex's (which is not written yet)
        res = self.app.get(f"/api/projects/{project_id}/reviews", headers=headers_jane)
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        self.assertEqual(len(data["data"]["reviews"]), 1)
        self.assertTrue(data["data"]["blinded"])
        print("[PASS] Double-blind reviewer separation (Jane sees only her review)")

        # Log out, log in Alex
        self.app.post("/api/auth/logout")
        res = self.app.post("/api/auth/login", json=login_alex)
        alex_csrf = json.loads(res.data)["data"]["csrf_token"]
        headers_alex = {"X-CSRF-Token": alex_csrf}

        # Get reviews as Alex -> Alex sees empty list (Jane's review is hidden)
        res = self.app.get(f"/api/projects/{project_id}/reviews", headers=headers_alex)
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        self.assertEqual(len(data["data"]["reviews"]), 0)
        self.assertTrue(data["data"]["blinded"])
        print("[PASS] Double-blind reviewer separation (Alex cannot see Jane's review yet)")

        # Alex submits review
        review_payload_alex = {
            "rating": 5,
            "comment": "Jane was very clear with specifications and approved payouts instantly!"
        }
        res = self.app.post(f"/api/projects/{project_id}/reviews", json=review_payload_alex, headers=headers_alex)
        self.assertEqual(res.status_code, 201)

        # Get reviews as Alex -> now BOTH reviews are revealed
        res = self.app.get(f"/api/projects/{project_id}/reviews", headers=headers_alex)
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        self.assertEqual(len(data["data"]["reviews"]), 2)
        self.assertFalse(data["data"].get("blinded", False))
        print("[PASS] Double-blind release (both reviews revealed after mutual submission)")

        # ----------------------------------------------------
        # 17. Wallet Transaction Logging
        # ----------------------------------------------------
        # Get transactions for Alex
        res = self.app.get("/api/wallet/transactions", headers=headers_alex)
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        self.assertTrue(data["success"])
        txs = data["data"]["transactions"]
        
        # Verify transaction log matches escrow release amount ($900 = 90000 cents)
        release_tx = next((t for t in txs if t["transaction_type"] == "escrow_release"), None)
        self.assertIsNotNone(release_tx)
        self.assertEqual(release_tx["amount_cents"], 90000)
        self.assertEqual(release_tx["balance_after_cents"], 175000)
        print("[PASS] Wallet transaction logging")
        print("\n--- ALL VERIFICATION TESTS COMPLETED SUCCESSFULLY ---")

if __name__ == "__main__":
    unittest.main()
