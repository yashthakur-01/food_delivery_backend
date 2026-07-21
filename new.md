## Delivery dashboard
The Delivery dashboard frontend look like so:

<img width="270" height="518" alt="Image" src="https://github.com/user-attachments/assets/2da0208b-67c4-4a83-b870-5bae727330ed" />

the data currently sent by the backend is looks like this:

https://github.com/santomeridia-collab/food_delivery_backend/blob/24f07f2076164ec62e09dff437a5c4b5288c055e/src/modules/delivery/service.js#L89-L107

There are a few imporatant fields missing in the data i.e. rating, acceptanceRate and onlineHours.Today.

<br/>

## Login response
The login controller response only contains the issued refreshToken and accessToken here:

https://github.com/santomeridia-collab/food_delivery_backend/blob/24f07f2076164ec62e09dff437a5c4b5288c055e/src/modules/auth/controller.js#L23-L28

**Whereas** the logout requires the userId, which is never sent to the frontend.
and there's also an ambiguous response from the server on the /api/auth/refresh route when the refreshToken is not provided, the server responds with InternalServerError even though the client sent an invalid request as it didn't contain the refreshToken in the body.
This happens due to no null checking or optional channing of refreshToken in `req.body.refreshToken` here:
https://github.com/santomeridia-collab/food_delivery_backend/blob/24f07f2076164ec62e09dff437a5c4b5288c055e/src/modules/auth/controller.js#L49

<br/>

## Proposal
1. For `api/delivery/dashboard` the response should contain rating, acceptanceRate and onlineHours.today.
2. The login response should contain the userId, role and identifier as that's used by the sessionManager in the frontend like so:

```dart
class SessionData {
  // TODO: FIX BUG user id is never recieved from the backend in any request.
  String? userId;
  String? identifier;
  String? accessToken;
  String? refreshToken;
  String? role;
}
```

3. The api/auth/refresh should do proper null checking on refreshToken and return an appropirate status i.e. either
**`422 Unprocessable Content`** or **`401 Unauthorized`**