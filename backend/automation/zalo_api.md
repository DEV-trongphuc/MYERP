Official Account API V3
Zalo hỗ trợ Java SDK gọi  Open API, tài liệu chi tiết, tích hợp dễ dàng, giảm thời gian tích hợp.

Gửi tin tư vấn dạng văn bản

ZaloOaClient client = new ZaloOaClient();
String access_token = "your_access_token";

Map<String, String> headers = new HashMap<>();
headers.put("access_token", access_token);

JsonObject recipient = new JsonObject();
recipient.addProperty("user_id", "2468458835296197922");

JsonObject text = new JsonObject();
text.addProperty("text", "text_message");

JsonObject body = new JsonObject();
body.add("recipient", recipient);
body.add("message", text);
System.err.println(body);

JsonObject excuteRequest = client.excuteRequest("https://openapi.zalo.me/v3.0/oa/message/cs", "POST", null, body, headers, null);


Gửi tin tư vấn đính kèm hình ảnh

ZaloOaClient client = new ZaloOaClient();
String access_token = "your_access_token";

Map<String, String> headers = new HashMap<>();
headers.put("access_token", access_token);

JsonObject element = new JsonObject();
element.addProperty("media_type", "image");
element.addProperty("url", "https://stc-developers.zdn.vn/images/bg_1.jpg");

JsonArray elements = new JsonArray();
elements.add(element);

JsonObject payload = new JsonObject();
payload.add("elements", elements);
payload.addProperty("template_type", "media");

JsonObject attachment = new JsonObject();
attachment.addProperty("type", "template");
attachment.add("payload", payload);

JsonObject message = new JsonObject();
message.add("attachment", attachment);
message.addProperty("text", "text_message");

JsonObject recipient = new JsonObject();
recipient.addProperty("user_id", "2468458835296197922");

JsonObject body = new JsonObject();
body.add("recipient", recipient);
body.add("message", message);
System.err.println(body);

JsonObject excuteRequest = client.excuteRequest("https://openapi.zalo.me/v3.0/oa/message/cs", "POST", null, body, headers, null);


Gửi tin Tư vấn theo mẫu yêu cầu thông tin người dùng

ZaloOaClient client = new ZaloOaClient();
String access_token = "your_access_token";

Map<String, String> headers = new HashMap<>();
headers.put("access_token", access_token);

JsonObject element = new JsonObject();
element.addProperty("image_url", "https://developers.zalo.me/web/static/zalo.png");
element.addProperty("title", "Official Account");
element.addProperty("subtitle", "Đang yêu cầu thông tin từ bạn");

JsonArray elements = new JsonArray();
elements.add(element);

JsonObject payload = new JsonObject();
payload.add("elements", elements);
payload.addProperty("template_type", "request_user_info");

JsonObject attachment = new JsonObject();
attachment.addProperty("type", "template");
attachment.add("payload", payload);

JsonObject message = new JsonObject();
message.add("attachment", attachment);

JsonObject recipient = new JsonObject();
recipient.addProperty("user_id", "2468458835296197922");

JsonObject body = new JsonObject();
body.add("recipient", recipient);
body.add("message", message);
System.err.println(body);

JsonObject excuteRequest = client.excuteRequest("https://openapi.zalo.me/v3.0/oa/message/cs", "POST", null, body, headers, null);


Gửi tin Tư vấn đính kèm file

ZaloOaClient client = new ZaloOaClient();
String access_token = "your_access_token";

Map<String, String> headers = new HashMap<>();
headers.put("access_token", access_token);

JsonObject payload = new JsonObject();
payload.addProperty("token", "token");

JsonObject attachment = new JsonObject();
attachment.addProperty("type", "file");
attachment.add("payload", payload);

JsonObject message = new JsonObject();
message.add("attachment", attachment);

JsonObject recipient = new JsonObject();
recipient.addProperty("user_id", "2468458835296197922");

JsonObject body = new JsonObject();
body.add("recipient", recipient);
body.add("message", message);
System.err.println(body);

JsonObject excuteRequest = client.excuteRequest("https://openapi.zalo.me/v3.0/oa/message/cs", "POST", null, body, headers, null);


Gửi tin Tư vấn trích dẫn

ZaloOaClient client = new ZaloOaClient();
String access_token = "your_access_token";

Map<String, String> headers = new HashMap<>();
headers.put("access_token", access_token);

JsonObject message = new JsonObject();
message.addProperty("react_message_id", "c6792f94f71be346ba09");
message.addProperty("text", "Chào bạn, Shop có địa chỉ là 182 Lê Đại Hành, P15, Q10, HCM");

JsonObject recipient = new JsonObject();
recipient.addProperty("user_id", "2468458835296197922");

JsonObject body = new JsonObject();
body.add("recipient", recipient);
body.add("message", message);
System.err.println(body);

JsonObject excuteRequest = client.excuteRequest("https://openapi.zalo.me/v3.0/oa/message/cs", "POST", null, body, headers, null);


Gửi tin Tư vấn kèm Sticker

ZaloOaClient client = new ZaloOaClient();
String access_token = "your_access_token";

Map<String, String> headers = new HashMap<>();
headers.put("access_token", access_token);

JsonObject element = new JsonObject();
element.addProperty("media_type", "sticker");
element.addProperty("attachment_id", "c09965c25987b0d9e996");

JsonArray elements = new JsonArray();
elements.add(element);

JsonObject payload = new JsonObject();
payload.add("elements", elements);
payload.addProperty("template_type", "media");

JsonObject attachment = new JsonObject();
attachment.addProperty("type", "template");
attachment.add("payload", payload);

JsonObject message = new JsonObject();
message.add("attachment", attachment);

JsonObject recipient = new JsonObject();
recipient.addProperty("user_id", "2468458835296197922");

JsonObject body = new JsonObject();
body.add("recipient", recipient);
body.add("message", message);
System.err.println(body);

JsonObject excuteRequest = client.excuteRequest("https://openapi.zalo.me/v3.0/oa/message/cs", "POST", null, body, headers, null);


Gửi tin Giao dịch

ZaloOaClient client = new ZaloOaClient();
String access_token = "your_access_token";

Map<String, String> headers = new HashMap<>();
headers.put("access_token", access_token);

JsonObject element1 = new JsonObject();
element1.addProperty("type", "banner");
element1.addProperty("image_url", "https://stc-developers.zdn.vn/images/bg_1.jpg");

JsonObject element2 = new JsonObject();
element2.addProperty("type", "header");
element2.addProperty("align", "left");
element2.addProperty("content", "Trạng thái đơn hàng");

JsonObject element3 = new JsonObject();
element3.addProperty("type", "text");
element3.addProperty("align", "left");
element3.addProperty("content", "• Cảm ơn bạn đã mua hàng tại cửa hàng.<br>• Thông tin đơn hàng của bạn như sau:");

JsonObject content1 = new JsonObject();
content1.addProperty("key", "Mã khách hàng");
content1.addProperty("value", "F-01332973223");

JsonObject content2 = new JsonObject();
content2.addProperty("key", "Trạng thái");
content2.addProperty("value", "Đang giao");
content2.addProperty("style", "yellow");

JsonObject content3 = new JsonObject();
content3.addProperty("key", "Giá tiền");
content3.addProperty("value", "250,000đ");

JsonArray content = new JsonArray();
content.add(content1);
content.add(content2);
content.add(content3);

JsonObject element4 = new JsonObject();
element4.addProperty("type", "table");
element4.add("content", content);

JsonObject element5 = new JsonObject();
element5.addProperty("type", "text");
element5.addProperty("align", "center");
element5.addProperty("content", "Lưu ý điện thoại. Xin cảm ơn!");

JsonArray elements = new JsonArray();
elements.add(element1);
elements.add(element2);
elements.add(element3);
elements.add(element4);
elements.add(element5);

JsonObject payloadButton1 = new JsonObject();
payloadButton1.addProperty("url", "https://oa.zalo.me/home");

JsonObject button1 = new JsonObject();
button1.add("payload", payloadButton1);
button1.addProperty("image_icon", "https://stc-developers.zdn.vn/images/bg_1.jpg");
button1.addProperty("title", "Kiểm tra lộ trình - default icon");
button1.addProperty("type", "oa.open.url");

JsonObject button2 = new JsonObject();
button2.addProperty("payload", "kiểm tra giỏ hàng");
button2.addProperty("image_icon", "https://stc-developers.zdn.vn/images/bg_1.jpg");
button2.addProperty("title", "Xem lại giỏ hàng");
button2.addProperty("type", "oa.query.show");

JsonObject payloadButton3 = new JsonObject();
payloadButton3.addProperty("phone_code", "84123456789");

JsonObject button3 = new JsonObject();
button3.add("payload", payloadButton3);
button3.addProperty("image_icon", "https://stc-developers.zdn.vn/images/bg_1.jpg");
button3.addProperty("title", "Liên hệ tổng đài");
button3.addProperty("type", "oa.open.phone");

JsonArray buttons = new JsonArray();
buttons.add(button1);
buttons.add(button2);
buttons.add(button3);

JsonObject payload = new JsonObject();
payload.add("elements", elements);
payload.add("buttons", buttons);
payload.addProperty("template_type", "transaction_order");
payload.addProperty("language", "VI");

JsonObject attachment = new JsonObject();
attachment.addProperty("type", "template");
attachment.add("payload", payload);

JsonObject message = new JsonObject();
message.add("attachment", attachment);

JsonObject recipient = new JsonObject();
recipient.addProperty("user_id", "2468458835296197922");

JsonObject body = new JsonObject();
body.add("recipient", recipient);
body.add("message", message);
System.err.println(body);

JsonObject excuteRequest = client.excuteRequest("https://openapi.zalo.me/v3.0/oa/message/transaction", "POST", null, body, headers, null);


Gửi tin Truyền thông Broadcast

ZaloOaClient client = new ZaloOaClient();
String access_token = "your_access_token";

Map<String, String> headers = new HashMap<>();
headers.put("access_token", access_token);

JsonObject element = new JsonObject();
element.addProperty("media_type", "article");
element.addProperty("attachment_id", "4402c73f7e7a9724ce6b");

JsonArray elements = new JsonArray();
elements.add(element);

JsonObject payload = new JsonObject();
payload.add("elements", elements);
payload.addProperty("template_type", "media");

JsonObject attachment = new JsonObject();
attachment.addProperty("type", "template");
attachment.add("payload", payload);

JsonObject message = new JsonObject();
message.add("attachment", attachment);

JsonObject target = new JsonObject();
target.addProperty("ages", 3);
target.addProperty("gender", 1);
target.addProperty("locations", 2);
target.addProperty("cities", 4);
target.addProperty("platform", 1);

JsonObject recipient = new JsonObject();
recipient.add("target", target);

JsonObject body = new JsonObject();
body.add("recipient", recipient);
body.add("message", message);
System.err.println(body);

JsonObject excuteRequest = client.excuteRequest("https://openapi.zalo.me/v2.0/oa/message", "POST", null, body, headers, null);

**Gửi tin Truyền thông cá nhân**

ZaloOaClient client = new ZaloOaClient();
String access_token = "your_access_token";

Map<String, String> headers = new HashMap<>();
headers.put("access_token", access_token);

JsonObject element1 = new JsonObject();
element1.addProperty("type", "banner");
element1.addProperty("image_url", "https://stc-developers.zdn.vn/images/bg_1.jpg");

JsonObject element2 = new JsonObject();
element2.addProperty("type", "header");
element2.addProperty("align", "left");
element2.addProperty("content", "Trạng thái đơn hàng");

JsonObject element3 = new JsonObject();
element3.addProperty("type", "text");
element3.addProperty("align", "left");
element3.addProperty("content", "• Cảm ơn bạn đã mua hàng tại cửa hàng.<br>• Thông tin đơn hàng của bạn như sau:");

JsonObject content1 = new JsonObject();
content1.addProperty("key", "Mã khách hàng");
content1.addProperty("value", "F-01332973223");

JsonObject content2 = new JsonObject();
content2.addProperty("key", "Trạng thái");
content2.addProperty("value", "Đang giao");
content2.addProperty("style", "yellow");

JsonObject content3 = new JsonObject();
content3.addProperty("key", "Giá tiền");
content3.addProperty("value", "250,000đ");

JsonArray content = new JsonArray();
content.add(content1);
content.add(content2);
content.add(content3);

JsonObject element4 = new JsonObject();
element4.addProperty("type", "table");
element4.add("content", content);

JsonObject element5 = new JsonObject();
element5.addProperty("type", "text");
element5.addProperty("align", "center");
element5.addProperty("content", "Lưu ý điện thoại. Xin cảm ơn!");

JsonArray elements = new JsonArray();
elements.add(element1);
elements.add(element2);
elements.add(element3);
elements.add(element4);
elements.add(element5);

JsonObject payloadButton1 = new JsonObject();
payloadButton1.addProperty("url", "https://oa.zalo.me/home");

JsonObject button1 = new JsonObject();
button1.add("payload", payloadButton1);
button1.addProperty("image_icon", "https://stc-developers.zdn.vn/images/bg_1.jpg");
button1.addProperty("title", "Kiểm tra lộ trình - default icon");
button1.addProperty("type", "oa.open.url");

JsonObject button2 = new JsonObject();
button2.addProperty("payload", "kiểm tra giỏ hàng");
button2.addProperty("image_icon", "https://stc-developers.zdn.vn/images/bg_1.jpg");
button2.addProperty("title", "Xem lại giỏ hàng");
button2.addProperty("type", "oa.query.show");

JsonObject payloadButton3 = new JsonObject();
payloadButton3.addProperty("phone_code", "84123456789");

JsonObject button3 = new JsonObject();
button3.add("payload", payloadButton3);
button3.addProperty("image_icon", "https://stc-developers.zdn.vn/images/bg_1.jpg");
button3.addProperty("title", "Liên hệ tổng đài");
button3.addProperty("type", "oa.open.phone");

JsonArray buttons = new JsonArray();
buttons.add(button1);
buttons.add(button2);
buttons.add(button3);

JsonObject payload = new JsonObject();
payload.add("elements", elements);
payload.add("buttons", buttons);
payload.addProperty("template_type", "promotion");

JsonObject attachment = new JsonObject();
attachment.addProperty("type", "template");
attachment.add("payload", payload);

JsonObject message = new JsonObject();
message.add("attachment", attachment);

JsonObject recipient = new JsonObject();
recipient.addProperty("user_id", "2468458835296197922");

JsonObject body = new JsonObject();
body.add("recipient", recipient);
body.add("message", message);
System.err.println(body);

JsonObject excuteRequest = client.excuteRequest("https://openapi.zalo.me/v3.0/oa/message/promotion", "POST", null, body, headers, null);


Gửi tin nhắn văn bản đến người dùng ẩn danh

ZaloOaClient client = new ZaloOaClient();
String access_token = "your_access_token";

Map<String, String> headers = new HashMap<>();
headers.put("access_token", access_token);

JsonObject recipient = new JsonObject();
recipient.addProperty("conversation_id", "conversation_id");
recipient.addProperty("anonymous_id", "anonymous_id");

JsonObject text = new JsonObject();
text.addProperty("text", "text_message");

JsonObject body = new JsonObject();
body.add("recipient", recipient);
body.add("message", text);
System.err.println(body);

JsonObject excuteRequest = client.excuteRequest("https://openapi.zalo.me/v2.0/oa/message", "POST", null, body, headers, null);


Gửi tin nhắn dạng ảnh đến người dùng ẩn danh

ZaloOaClient client = new ZaloOaClient();
String access_token = "your_access_token";

Map<String, String> headers = new HashMap<>();
headers.put("access_token", access_token);

JsonObject element = new JsonObject();
element.addProperty("media_type", "image");
element.addProperty("url", "https://stc-developers.zdn.vn/images/bg_1.jpg");

JsonArray elements = new JsonArray();
elements.add(element);

JsonObject payload = new JsonObject();
payload.add("elements", elements);
payload.addProperty("template_type", "media");

JsonObject attachment = new JsonObject();
attachment.addProperty("type", "template");
attachment.add("payload", payload);

JsonObject message = new JsonObject();
message.add("attachment", attachment);
message.addProperty("text", "text_message");

JsonObject recipient = new JsonObject();
recipient.addProperty("conversation_id", "conversation_id");
recipient.addProperty("anonymous_id", "anonymous_id");

JsonObject body = new JsonObject();
body.add("recipient", recipient);
body.add("message", message);
System.err.println(body);

JsonObject excuteRequest = client.excuteRequest("https://openapi.zalo.me/v2.0/oa/message", "POST", null, body, headers, null);


Gửi tin nhắn dạng file đến người dùng ẩn danh

ZaloOaClient client = new ZaloOaClient();
String access_token = "your_access_token";

Map<String, String> headers = new HashMap<>();
headers.put("access_token", access_token);

JsonObject payload = new JsonObject();
payload.addProperty("token", "token");

JsonObject attachment = new JsonObject();
attachment.addProperty("type", "file");
attachment.add("payload", payload);

JsonObject message = new JsonObject();
message.add("attachment", attachment);

JsonObject recipient = new JsonObject();
recipient.addProperty("conversation_id", "conversation_id");
recipient.addProperty("anonymous_id", "anonymous_id");

JsonObject body = new JsonObject();
body.add("recipient", recipient);
body.add("message", message);
System.err.println(body);

JsonObject excuteRequest = client.excuteRequest("https://openapi.zalo.me/v3.0/oa/message/cs", "POST", null, body, headers, null);


Gửi tin nhắn dạng sticker đến người dùng ẩn danh

ZaloOaClient client = new ZaloOaClient();
String access_token = "your_access_token";

Map<String, String> headers = new HashMap<>();
headers.put("access_token", access_token);

JsonObject element = new JsonObject();
element.addProperty("media_type", "sticker");
element.addProperty("attachment_id", "c09965c25987b0d9e996");

JsonArray elements = new JsonArray();
elements.add(element);

JsonObject payload = new JsonObject();
payload.add("elements", elements);
payload.addProperty("template_type", "media");

JsonObject attachment = new JsonObject();
attachment.addProperty("type", "template");
attachment.add("payload", payload);

JsonObject message = new JsonObject();
message.add("attachment", attachment);

JsonObject recipient = new JsonObject();
recipient.addProperty("conversation_id", "conversation_id");
recipient.addProperty("anonymous_id", "anonymous_id");

JsonObject body = new JsonObject();
body.add("recipient", recipient);
body.add("message", message);
System.err.println(body);

JsonObject excuteRequest = client.excuteRequest("https://openapi.zalo.me/v2.0/oa/message", "POST", null, body, headers, null);


Thả biểu tượng cảm xúc vào tin nhắn

ZaloOaClient client = new ZaloOaClient();
String access_token = "your_access_token";

Map<String, String> headers = new HashMap<>();
headers.put("access_token", access_token);

JsonObject recipient = new JsonObject();
recipient.addProperty("user_id", "2468458835296197922");

JsonObject sender_action = new JsonObject();
sender_action.addProperty("react_message_id", "6d3771b5c7f5d0a889e7");
sender_action.addProperty("react_icon", "/-strong");

JsonObject body = new JsonObject();
body.add("recipient", recipient);
body.add("sender_action", sender_action);
System.err.println(body);

JsonObject excuteRequest = client.excuteRequest("https://openapi.zalo.me/v2.0/oa/message", "POST", null, body, headers, null);


Upload ảnh GIF

ZaloOaClient client = new ZaloOaClient();
String access_token = "your_access_token";

Map<String, String> headers = new HashMap<>();
headers.put("access_token", access_token);

Map<String, File> files = new HashMap<>();
File file = new File("/path/to/file");
files.put("file", file);

JsonObject excuteRequest = client.excuteRequest("https://dev-openapi.zalo.me/v2.0/oa/upload/gif", "POST", null, null, headers, files);


Upload File

ZaloOaClient client = new ZaloOaClient();
String access_token = "your_access_token";

Map<String, String> headers = new HashMap<>();
headers.put("access_token", access_token);

Map<String, File> files = new HashMap<>();
File file = new File("/path/to/file");
files.put("file", file);

JsonObject excuteRequest = client.excuteRequest("https://dev-openapi.zalo.me/v2.0/oa/upload/file", "POST", null, null, headers, files);


Kiểm tra hạn mức Tin tư vấn miễn phí

ZaloOaClient client = new ZaloOaClient();
String access_token = "your_access_token";

Map<String, String> headers = new HashMap<>();
headers.put("access_token", access_token);

JsonObject excuteRequest = client.excuteRequest("https://openapi.zalo.me/v2.0/oa/quota/message", "POST", null, null, headers, null);


Lấy danh sách các tin nhắn gần nhất

ZaloOaClient client = new ZaloOaClient();
String access_token = "your_access_token";

Map<String, String> headers = new HashMap<>();
headers.put("access_token", access_token);

JsonObject dataValue = new JsonObject();
dataValue.addProperty("offset", 0);
dataValue.addProperty("count", 5);

Map<String, Object> params = new HashMap<>();
params.put("data", dataValue.toString());

JsonObject excuteRequest = client.excuteRequest("https://openapi.zalo.me/v2.0/oa/listrecentchat", "GET", params, null, headers, null);