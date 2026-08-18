from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from app.core.database import SessionLocal, engine, Base
from app import models
from app.routers.auth import get_password_hash
from app.services.rag import rag_service

def seed_db():
    print("Starting database seeding...")
    db = SessionLocal()
    try:
        # Create tables
        Base.metadata.create_all(bind=engine)

        # 1. Seed Corporate Users
        users_to_add = [
            {
                "username": "admin",
                "email": "admin@enterprise.ai",
                "role": "System Admin",
                "full_name": "Vikramaditya Rao",
                "age": 45,
                "gender": "Male",
                "social_category": "General",
                "village": "Headquarters",
                "block": "IT & Infrastructure",
                "district": "Mumbai",
                "state": "Maharashtra"
            },
            {
                "username": "ceo",
                "email": "ceo@enterprise.ai",
                "role": "CEO",
                "full_name": "Rajendra Prasad",
                "age": 52,
                "gender": "Male",
                "social_category": "General",
                "village": "Headquarters",
                "block": "Executive Leadership",
                "district": "Mumbai",
                "state": "Maharashtra"
            },
            {
                "username": "manager",
                "email": "manager@enterprise.ai",
                "role": "Manager",
                "full_name": "Ananya Roy",
                "age": 34,
                "gender": "Female",
                "social_category": "General",
                "village": "Headquarters",
                "block": "Engineering & Product",
                "district": "Mumbai",
                "state": "Maharashtra"
            },
            {
                "username": "employee1",
                "email": "priya.m@enterprise.ai",
                "role": "Employee",
                "full_name": "Priya Mehta",
                "age": 29,
                "gender": "Female",
                "social_category": "General",
                "village": "Headquarters",
                "block": "Security & Compliance",
                "district": "Mumbai",
                "state": "Maharashtra"
            },
            {
                "username": "employee2",
                "email": "alex.j@enterprise.ai",
                "role": "Employee",
                "full_name": "Alex Johnson",
                "age": 31,
                "gender": "Male",
                "social_category": "General",
                "village": "Headquarters",
                "block": "DevOps Operations",
                "district": "Mumbai",
                "state": "Maharashtra"
            }
        ]

        seeded_users = {}
        for u_data in users_to_add:
            existing = db.query(models.User).filter(models.User.username == u_data["username"]).first()
            if not existing:
                pwd_hash = get_password_hash("password123")
                user = models.User(
                    username=u_data["username"],
                    email=u_data["email"],
                    hashed_password=pwd_hash,
                    role=u_data["role"],
                    full_name=u_data["full_name"],
                    age=u_data["age"],
                    gender=u_data["gender"],
                    social_category=u_data["social_category"],
                    village=u_data["village"],
                    block=u_data["block"],
                    district=u_data["district"],
                    state=u_data["state"]
                )
                db.add(user)
                db.commit()
                db.refresh(user)
                seeded_users[u_data["username"]] = user
                print(f"Seeded user: {u_data['username']}")
            else:
                seeded_users[u_data["username"]] = existing

        sec_id = seeded_users["manager"].id
        mod_id = seeded_users["ceo"].id

        # 2. Seed Meeting 1: Q3 Executive Strategy & Product Review (Approved)
        m1 = db.query(models.Meeting).filter(models.Meeting.title == "Q3 Executive Strategy & Product Review").first()
        if not m1:
            m1 = models.Meeting(
                title="Q3 Executive Strategy & Product Review",
                description="Executive meeting covering Q3 strategy, microservice decoupling, and cloud budget.",
                date=datetime.now() - timedelta(days=5),
                meeting_type="Executive",
                department="Product & Engineering",
                location="Conference Room A / Hybrid",
                meeting_link="https://meet.enterprise.ai/q3-review",
                status="approved",
                agenda="1. Microservice infrastructure roadmap.\n2. Cloud GPU budget approval.\n3. Security compliance sign-off.",
                qr_code_data="meeting_pass:meeting_id=1",
                secretary_id=sec_id,
                chairperson_id=mod_id
            )
            db.add(m1)
            db.commit()
            db.refresh(m1)

            t1 = models.Transcript(
                meeting_id=m1.id,
                raw_text="Ananya opened the Q3 strategy review. Rahul presented the microservice decoupling roadmap. Vikramaditya approved fifty thousand dollars for cloud GPU infrastructure.",
                diarized_json=[
                    {"speaker": "Ananya Roy (Host)", "start": 0.0, "end": 8.0, "text": "Welcome team to the Q3 executive strategy review."},
                    {"speaker": "Rahul Sharma (Chair)", "start": 8.5, "end": 18.0, "text": "We recommend decoupling our core API microservices before Q4 to scale speech diarization."},
                    {"speaker": "Vikramaditya Rao (VP)", "start": 18.5, "end": 28.0, "text": "We approve the microservice roadmap and sanction fifty thousand dollars for GPU cluster nodes."}
                ],
                language="en",
                confidence=0.98
            )
            db.add(t1)

            min1 = models.Minutes(
                meeting_id=m1.id,
                summary="The executive team reviewed Q3 strategy, approved microservice decoupling, and sanctioned $50,000 for cloud GPU scaling.",
                topics=[
                    {"topic": "Microservice Architecture", "discussion": "Decoupling core API microservices before Q4.", "source_segments": ["segment_2"]}
                ],
                decisions=[
                    {"decision": "Approved microservice migration & $50,000 cloud GPU budget", "context": "Confirmed by VP.", "source_segments": ["segment_3"]}
                ],
                issues_and_risks=[
                    {"issue": "Legacy API backward compatibility", "impact": "Requires 2 weeks testing.", "source_segments": ["segment_2"]}
                ],
                follow_ups=[
                    {"item": "Security compliance review", "owner": "Priya Mehta", "date": (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d"), "source_segments": ["segment_3"]}
                ],
                financial_information=[
                    {"item": "Cloud GPU Cluster Allocation", "amount": "$50,000", "source_segments": ["segment_3"]}
                ],
                additional_notes="Slide decks uploaded to repository.",
                digital_hash="8f9a2c3b4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b",
                approved_by_id=mod_id,
                approved_at=datetime.utcnow() - timedelta(days=5)
            )
            db.add(min1)

            act1 = models.ActionItem(
                meeting_id=m1.id,
                title="Provision GPU cloud clusters for speech pipeline",
                description="Set up auto-scaling GPU compute instances for Whisper transcription.",
                owner_user_id=seeded_users["manager"].id,
                responsible_person="Ananya Roy",
                department="Engineering",
                deadline=datetime.now() + timedelta(days=14),
                status="in_progress",
                source_segments=["segment_3"]
            )
            db.add(act1)
            db.commit()

            rag_service.add_document(
                meeting_id=m1.id,
                title=m1.title,
                text="The executive team reviewed Q3 strategy, approved microservice decoupling, and sanctioned $50,000 for cloud GPU scaling."
            )
            print("Seeded meeting: Q3 Executive Strategy & Product Review")

        # 3. Seed Meeting 2: Core API & Infrastructure Architecture Sync (Needs Review / Draft)
        m2 = db.query(models.Meeting).filter(models.Meeting.title == "Core API & Infrastructure Architecture Sync").first()
        if not m2:
            m2 = models.Meeting(
                title="Core API & Infrastructure Architecture Sync",
                description="Engineering deep-dive on OAuth2 microservice migration, database query indexing, and SLA monitoring.",
                date=datetime.now() - timedelta(days=1),
                meeting_type="Engineering",
                department="Engineering",
                location="Virtual Zoom Link",
                meeting_link="https://meet.enterprise.ai/api-sync",
                status="draft",
                agenda="1. OAuth2 microservice migration.\n2. PostgreSQL indexing optimization.\n3. Action item assignments.",
                qr_code_data="meeting_pass:meeting_id=2",
                secretary_id=sec_id,
                chairperson_id=mod_id
            )
            db.add(m2)
            db.commit()
            db.refresh(m2)

            t2 = models.Transcript(
                meeting_id=m2.id,
                raw_text="Rahul called the API sync to order. Priya outlined the security audit requirements. Alex confirmed database index optimization is complete.",
                diarized_json=[
                    {"speaker": "Rahul Sharma", "start": 0.0, "end": 10.0, "text": "Let us review our core API endpoint performance and database indexing."},
                    {"speaker": "Priya Mehta", "start": 10.5, "end": 22.0, "text": "I will submit the security audit report by Friday."},
                    {"speaker": "Alex Johnson", "start": 22.5, "end": 35.0, "text": "Database indexing on meetings and action_items tables is complete."}
                ],
                language="en",
                confidence=0.97
            )
            db.add(t2)

            min2 = models.Minutes(
                meeting_id=m2.id,
                summary="Engineering confirmed database indexing completion and assigned Priya to submit the security audit report by Friday.",
                topics=[
                    {"topic": "API Performance & Indexing", "discussion": "Database indexes applied to meetings and action items tables.", "source_segments": ["segment_3"]}
                ],
                decisions=[
                    {"decision": "Proceed with OAuth2 microservice staging deployment", "context": "Confirmed by engineering team.", "source_segments": ["segment_1"]}
                ],
                issues_and_risks=[
                    {"issue": "Staging server capacity", "impact": "Requires additional staging memory.", "source_segments": ["segment_2"]}
                ],
                follow_ups=[],
                financial_information=[],
                additional_notes="PRs merged into main branch."
            )
            db.add(min2)

            act2 = models.ActionItem(
                meeting_id=m2.id,
                title="Submit security audit compliance report",
                description="Finalize penetration testing and OAuth2 audit documentation.",
                owner_user_id=seeded_users["employee1"].id,
                responsible_person="Priya Mehta",
                department="Security & Compliance",
                deadline=datetime.now() + timedelta(days=5),
                status="pending",
                source_segments=["segment_2"]
            )
            db.add(act2)
            db.commit()

            rag_service.add_document(
                meeting_id=m2.id,
                title=m2.title,
                text="Engineering confirmed database indexing completion and assigned Priya to submit the security audit report by Friday."
            )
            print("Seeded meeting: Core API & Infrastructure Architecture Sync")

            # Seed Organization & Departments if missing
            org = db.query(models.Organization).filter(models.Organization.code == "ACME").first()
            if not org:
                org = models.Organization(name="Acme Global Enterprise", code="ACME", domain="enterprise.ai")
                db.add(org)
                db.commit()
                db.refresh(org)

                dept_eng = models.Department(organization_id=org.id, name="Engineering & Architecture", code="ENG")
                dept_sec = models.Department(organization_id=org.id, name="Security & Compliance", code="SEC")
                dept_exec = models.Department(organization_id=org.id, name="Executive Leadership", code="EXEC")
                db.add_all([dept_eng, dept_sec, dept_exec])
                db.commit()

            # Seed Decisions for Meeting 1 & Meeting 2 if missing
            if db.query(models.Decision).count() == 0:
                dec1 = models.Decision(
                    organization_id=org.id,
                    meeting_id=1,
                    decision_text="Approve GPU cluster expansion budget of $120,000 for Q3 AI model fine-tuning.",
                    rationale="High model throughput demands require scaling GPU nodes to prevent diarization bottlenecks.",
                    impact_level="HIGH",
                    category="Financial",
                    status="SEALED",
                    source_timestamp=45.2,
                    source_speaker="Rajendra Prasad (CEO)",
                    evidence_text="GPU budget is approved up to $120k for Q3 AI scaling.",
                    confidence=0.96,
                    participants=["Rajendra Prasad", "Vikramaditya Rao", "Ananya Roy"]
                )
                dec2 = models.Decision(
                    organization_id=org.id,
                    meeting_id=2,
                    decision_text="Adopt microservices architecture for OAuth2 & single-sign-on auth service.",
                    rationale="Decoupling authentication from core API server improves availability and security compliance.",
                    impact_level="HIGH",
                    category="Architecture",
                    status="APPROVED",
                    source_timestamp=12.8,
                    source_speaker="Rahul Sharma (Host)",
                    evidence_text="Proceed with OAuth2 microservice staging deployment.",
                    confidence=0.94,
                    participants=["Rahul Sharma", "Priya Mehta", "Alex Johnson"]
                )
                dec3 = models.Decision(
                    organization_id=org.id,
                    meeting_id=1,
                    decision_text="Enforce mandatory SHA-256 cryptographic audit sealing on all executive meeting minutes.",
                    rationale="Required by SOC2 Type II compliance standards and corporate governance policies.",
                    impact_level="MEDIUM",
                    category="Policy",
                    status="SEALED",
                    source_timestamp=98.5,
                    source_speaker="Vikramaditya Rao (System Admin)",
                    evidence_text="Every finalized meeting document must contain an immutable SHA-256 digital signature.",
                    confidence=0.98,
                    participants=["Vikramaditya Rao", "Priya Mehta"]
                )
                db.add_all([dec1, dec2, dec3])
                db.commit()

            # Seed Action Items for Action Items Dashboard
            if db.query(models.ActionItem).count() < 4:
                act_items = [
                    models.ActionItem(
                        organization_id=org.id,
                        meeting_id=1,
                        decision_id=dec1.id,
                        title="Procure H100 GPU Server Cluster Infrastructure",
                        description="Issue RFP and finalize cloud provider agreement for 8x H100 node cluster.",
                        responsible_person="Alex Johnson",
                        department="Engineering & Architecture",
                        deadline=datetime.now() + timedelta(days=10),
                        priority="HIGH",
                        status="IN_PROGRESS",
                        source_timestamp=52.0,
                        source_speaker="Alex Johnson",
                        evidence_text="Alex will lead procurement for the 8x H100 node cluster.",
                        confidence=0.95
                    ),
                    models.ActionItem(
                        organization_id=org.id,
                        meeting_id=2,
                        decision_id=dec2.id,
                        title="Submit OAuth2 Security & Penetration Audit Report",
                        description="Complete vulnerability scan and upload compliance sign-off document.",
                        responsible_person="Priya Mehta",
                        department="Security & Compliance",
                        deadline=datetime.now() + timedelta(days=3),
                        priority="HIGH",
                        status="TO_DO",
                        source_timestamp=22.5,
                        source_speaker="Priya Mehta",
                        evidence_text="I will submit the security audit report by Friday.",
                        confidence=0.96
                    ),
                    models.ActionItem(
                        organization_id=org.id,
                        meeting_id=1,
                        title="Benchmark Multi-Signal Diarization Engine Accuracy",
                        description="Run DER evaluation script on 12 controlled test scenarios.",
                        responsible_person="Ananya Roy",
                        department="Engineering & Architecture",
                        deadline=datetime.now() - timedelta(days=2),
                        priority="MEDIUM",
                        status="COMPLETED",
                        source_timestamp=110.0,
                        source_speaker="Ananya Roy",
                        evidence_text="Evaluation on 12 benchmark cases completed with 0.0% DER.",
                        confidence=0.99
                    ),
                    models.ActionItem(
                        organization_id=org.id,
                        meeting_id=2,
                        title="Finalize PostgreSQL Indexes for Meetings & Actions Tables",
                        description="Verify query performance under 100,000 active meeting records.",
                        responsible_person="Rahul Sharma",
                        department="Engineering & Architecture",
                        deadline=datetime.now() - timedelta(days=1),
                        priority="HIGH",
                        status="OVERDUE",
                        source_timestamp=35.0,
                        source_speaker="Alex Johnson",
                        evidence_text="Database indexing on meetings and action_items tables requires load verification.",
                        confidence=0.91
                    )
                ]
                db.add_all(act_items)
                db.commit()

    except Exception as e:
        db.rollback()
        print(f"Error during seeding: {str(e)}")
        raise e
    finally:
        db.close()
    print("Database seeding completed successfully.")

if __name__ == "__main__":
    seed_db()
