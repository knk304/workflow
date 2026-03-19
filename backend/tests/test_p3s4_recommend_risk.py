import pytest
from httpx import AsyncClient
from unittest.mock import patch
from backend.main import app

@pytest.mark.asyncio
async def test_recommendation_agent_valid_case(test_db, seed_case):
    from agents.recommendation_agent import RecommendationAgent
    agent = RecommendationAgent()
    resp = await agent.run(case_id=seed_case["_id"])
    assert resp.case_id == str(seed_case["_id"])
    assert isinstance(resp.recommendations, list)

@pytest.mark.asyncio
async def test_recommendation_agent_case_not_found():
    from agents.recommendation_agent import RecommendationAgent
    agent = RecommendationAgent()
    with pytest.raises(ValueError):
        await agent.run(case_id="nonexistent")

@pytest.mark.asyncio
async def test_risk_agent_valid_case(test_db, seed_case):
    from agents.risk_agent import RiskAgent
    agent = RiskAgent()
    resp = await agent.run(case_id=seed_case["_id"])
    assert resp.case_id == str(seed_case["_id"])
    assert isinstance(resp.risk_flags, list)
    assert resp.overall_risk in ("low", "medium", "high", "critical")

@pytest.mark.asyncio
async def test_risk_agent_case_not_found():
    from agents.risk_agent import RiskAgent
    agent = RiskAgent()
    with pytest.raises(ValueError):
        await agent.run(case_id="nonexistent")

@pytest.mark.asyncio
async def test_api_recommend_endpoint(test_db, seed_case, auth_token):
    async with AsyncClient(app=app, base_url="http://test") as ac:
        resp = await ac.get(f"/api/ai/recommend/{seed_case['_id']}", headers={"Authorization": f"Bearer {auth_token}"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["case_id"] == str(seed_case["_id"])
        assert isinstance(data["recommendations"], list)

@pytest.mark.asyncio
async def test_api_risk_endpoint(test_db, seed_case, auth_token):
    async with AsyncClient(app=app, base_url="http://test") as ac:
        resp = await ac.get(f"/api/ai/risk/{seed_case['_id']}", headers={"Authorization": f"Bearer {auth_token}"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["case_id"] == str(seed_case["_id"])
        assert isinstance(data["risk_flags"], list)
        assert data["overall_risk"] in ("low", "medium", "high", "critical")
