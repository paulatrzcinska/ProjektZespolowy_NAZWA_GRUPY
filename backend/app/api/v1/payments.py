from fastapi import APIRouter, Depends

from app.api.deps import CurrentUser, DbSession, ResourceId
from app.api.responses import error_responses
from app.schemas.payment import MockCompletionRequest, MockSessionRequest, PaymentRead
from app.services import payments

router = APIRouter(
    prefix="/payments", tags=["payments"], responses=error_responses(401, 404)
)


@router.post(
    "/mock/sessions",
    response_model=PaymentRead,
    status_code=201,
    dependencies=[Depends(payments.require_mock)],
    responses=error_responses(409),
    summary="Create or reuse a local simulated payment",
)
async def mock_session(
    body: MockSessionRequest, user: CurrentUser, db: DbSession
) -> PaymentRead:
    return await payments.create_mock_session(db, user.id, body.order_id)


@router.post(
    "/mock/{payment_id}/complete",
    response_model=PaymentRead,
    dependencies=[Depends(payments.require_mock)],
    responses=error_responses(409),
    summary="Simulate success or failure locally",
)
async def mock_complete(
    payment_id: ResourceId,
    body: MockCompletionRequest,
    user: CurrentUser,
    db: DbSession,
) -> PaymentRead:
    return await payments.complete_mock(db, user.id, payment_id, body.outcome)


@router.get("/{payment_id}/status", response_model=PaymentRead)
async def payment_status(
    payment_id: ResourceId, user: CurrentUser, db: DbSession
) -> PaymentRead:
    return await payments.read_payment(db, user.id, payment_id)
