# Bitrix24 Webhook Wychodzący (Outgoing)

Nasza aplikacja wystawia publiczny endpoint do odbioru zdarzeń webhooka „Outgoing webhook” z Bitrix24.

## URL do wklejenia w Bitrix

W polu **„Twój adres URL obsługuj”** wklej:

`https://<twoja-domena>/api/v1/webhooks/bitrix/outgoing/<TOKEN_APLIKACJI>`

gdzie:
- `TOKEN_APLIKACJI` to wartość „token aplikacji” generowana w konfiguracji webhooka w Bitrix24.

Na środowisku lokalnym:

`http://localhost:3000/api/v1/webhooks/bitrix/outgoing/<TOKEN_APLIKACJI>`

## Jak to działa (w skrócie)

- Bitrix wysyła `POST` z `event`, `data` oraz sekcją `auth`.
- `application_token` w payload ma odpowiadać wartości w ścieżce URL.
- Endpoint weryfikuje token i zwraca:
  - `200 OK` dla poprawnych wywołań
  - `401` gdy token się nie zgadza

