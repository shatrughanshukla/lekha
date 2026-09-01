package utils

import "github.com/gin-gonic/gin"

// Lang identifies a supported UI/response language. Adding a third
// language later means adding a value here and a row per key below —
// nothing else in the request pipeline needs to change.
type Lang string

const (
	LangEN Lang = "en"
	LangHI Lang = "hi"
)

// IsValidLang reports whether s is a language this backend can respond in.
func IsValidLang(s string) bool {
	return s == string(LangEN) || s == string(LangHI)
}

// messages is the single source of truth for every user-facing string the
// backend returns. Handlers should never write an error/message string
// inline — they call Msg(c, "key") instead, so a user's language choice
// actually changes what they see everywhere, not just in the React UI.
var messages = map[string]map[Lang]string{
	// -- validation / request shape --
	"invalid_id":            {LangEN: "invalid id format, expected a UUID", LangHI: "अमान्य आईडी प्रारूप, एक UUID अपेक्षित है"},
	"invalid_company_id":    {LangEN: "invalid company_id format, expected a UUID", LangHI: "अमान्य company_id प्रारूप, एक UUID अपेक्षित है"},
	"invalid_account_id":    {LangEN: "invalid account_id format, expected a UUID", LangHI: "अमान्य account_id प्रारूप, एक UUID अपेक्षित है"},
	"company_id_required":   {LangEN: "company_id query parameter is required", LangHI: "company_id क्वेरी पैरामीटर आवश्यक है"},
	"invalid_status":        {LangEN: "invalid status value", LangHI: "अमान्य स्थिति (status) मान"},
	"invalid_request_data":  {LangEN: "invalid request data", LangHI: "अमान्य अनुरोध डेटा"},
	"invalid_value_request": {LangEN: "invalid value in request", LangHI: "अनुरोध में अमान्य मान"},
	"too_many_signin_attempts": {LangEN: "too many sign-in attempts — please wait a few minutes and try again", LangHI: "बहुत अधिक साइन-इन प्रयास — कृपया कुछ मिनट रुककर पुनः प्रयास करें"},
	"too_many_signup_attempts": {LangEN: "too many attempts — please wait a few minutes and try again", LangHI: "बहुत अधिक प्रयास — कृपया कुछ मिनट रुककर पुनः प्रयास करें"},

	// -- not found --
	"company_not_found":  {LangEN: "company not found", LangHI: "कंपनी नहीं मिली"},
	"account_not_found":  {LangEN: "account not found", LangHI: "खाता नहीं मिला"},
	"transfer_not_found": {LangEN: "transfer not found", LangHI: "ट्रांसफर नहीं मिला"},
	"user_not_found":     {LangEN: "user not found", LangHI: "उपयोगकर्ता नहीं मिला"},
	"no_user_with_email": {LangEN: "no user found with that email", LangHI: "उस ईमेल से कोई उपयोगकर्ता नहीं मिला"},

	// -- auth --
	"invalid_email_or_password": {LangEN: "invalid email or password", LangHI: "अमान्य ईमेल या पासवर्ड"},
	"missing_auth_header":       {LangEN: "missing Authorization header", LangHI: "Authorization हेडर गुम है"},
	"bad_auth_format":           {LangEN: "expected format: Bearer <token>", LangHI: "अपेक्षित प्रारूप: Bearer <token>"},
	"invalid_token":             {LangEN: "invalid or expired token", LangHI: "अमान्य या समाप्त हो चुका टोकन"},
	"token_gen_failed":          {LangEN: "failed to generate token", LangHI: "टोकन बनाने में विफल"},
	"hash_failed":               {LangEN: "failed to hash password", LangHI: "पासवर्ड हैश करने में विफल"},
	"incorrect_current_password": {LangEN: "current password is incorrect", LangHI: "मौजूदा पासवर्ड गलत है"},
	"own_password_only":         {LangEN: "you can only change your own password", LangHI: "आप केवल अपना पासवर्ड ही बदल सकते हैं"},
	"password_changed":          {LangEN: "password changed", LangHI: "पासवर्ड बदल दिया गया"},

	// -- transfers --
	"from_account_not_found":       {LangEN: "from_account not found", LangHI: "प्रेषक खाता (from_account) नहीं मिला"},
	"to_account_not_found":         {LangEN: "to_account not found", LangHI: "प्राप्तकर्ता खाता (to_account) नहीं मिला"},
	"from_account_inactive":        {LangEN: "from_account is not active", LangHI: "प्रेषक खाता सक्रिय नहीं है"},
	"to_account_inactive":          {LangEN: "to_account is not active", LangHI: "प्राप्तकर्ता खाता सक्रिय नहीं है"},
	"insufficient_balance":         {LangEN: "insufficient balance in from_account", LangHI: "प्रेषक खाते में अपर्याप्त शेष राशि"},
	"sending_account_inactive":     {LangEN: "the sending account is no longer active", LangHI: "भेजने वाला खाता अब सक्रिय नहीं है"},
	"sending_account_insufficient": {LangEN: "the sending account no longer has sufficient balance", LangHI: "भेजने वाले खाते में अब पर्याप्त शेष राशि नहीं है"},
	"only_receiver_can_approve":    {LangEN: "only the receiving company can approve a pending transfer", LangHI: "केवल प्राप्तकर्ता कंपनी ही लंबित ट्रांसफर को स्वीकृत कर सकती है"},
	"only_completed_can_reverse":   {LangEN: "only a completed transfer can be proposed for reversal", LangHI: "केवल पूर्ण हो चुके ट्रांसफर को ही उलटने के लिए प्रस्तावित किया जा सकता है"},
	"proposal_already_pending":     {LangEN: "there is already a proposal awaiting a decision on this transfer", LangHI: "इस ट्रांसफर पर पहले से ही एक प्रस्ताव निर्णय की प्रतीक्षा में है"},
	"already_proposed_by_you":      {LangEN: "you already proposed this change — waiting on the other company to respond", LangHI: "आपने पहले ही यह बदलाव प्रस्तावित किया है — दूसरी कंपनी के जवाब का इंतज़ार है"},
	"only_proposer_can_withdraw":   {LangEN: "only the company that proposed this can withdraw it", LangHI: "जिस कंपनी ने यह प्रस्तावित किया है केवल वही इसे वापस ले सकती है"},
	"nothing_awaiting_approval":    {LangEN: "there is nothing awaiting approval on this transfer", LangHI: "इस ट्रांसफर पर स्वीकृति के लिए कुछ भी लंबित नहीं है"},

	// -- accounts --
	"only_admin_activate": {LangEN: "only an admin of this company can activate or deactivate an account", LangHI: "केवल इस कंपनी का एडमिन ही किसी खाते को सक्रिय या निष्क्रिय कर सकता है"},

	// -- members / roles --
	"only_admin_add_members":    {LangEN: "only an admin of this company can add members", LangHI: "केवल इस कंपनी का एडमिन ही सदस्य जोड़ सकता है"},
	"only_admin_change_roles":   {LangEN: "only an admin of this company can change member roles", LangHI: "केवल इस कंपनी का एडमिन ही सदस्यों की भूमिका बदल सकता है"},
	"only_admin_remove_members": {LangEN: "only an admin of this company can remove members", LangHI: "केवल इस कंपनी का एडमिन ही सदस्यों को हटा सकता है"},
	"not_a_member":              {LangEN: "that user is not a member of this company", LangHI: "वह उपयोगकर्ता इस कंपनी का सदस्य नहीं है"},
	"cannot_demote_last_admin":  {LangEN: "cannot demote the last admin — promote someone else first", LangHI: "अंतिम एडमिन को पदावनत नहीं किया जा सकता — पहले किसी और को प्रमोट करें"},
	"cannot_remove_last_admin":  {LangEN: "cannot remove the last admin — promote someone else first", LangHI: "अंतिम एडमिन को हटाया नहीं जा सकता — पहले किसी और को प्रमोट करें"},

	// -- profile picture --
	"own_picture_only":       {LangEN: "you can only update your own profile picture", LangHI: "आप केवल अपनी प्रोफ़ाइल तस्वीर ही बदल सकते हैं"},
	"no_photo_provided":      {LangEN: `no photo file provided (expected form field "photo")`, LangHI: `कोई फ़ोटो फ़ाइल प्रदान नहीं की गई (फॉर्म फ़ील्ड "photo" अपेक्षित है)`},
	"photo_too_large":        {LangEN: "image is too large — max size is 5MB", LangHI: "छवि बहुत बड़ी है — अधिकतम आकार 5MB है"},
	"unsupported_image_type": {LangEN: "unsupported image type — use JPEG, PNG, WEBP, or GIF", LangHI: "असमर्थित छवि प्रकार — JPEG, PNG, WEBP, या GIF का उपयोग करें"},
	"could_not_read_file":    {LangEN: "could not read uploaded file", LangHI: "अपलोड की गई फ़ाइल पढ़ी नहीं जा सकी"},
	"photo_upload_failed":    {LangEN: "photo upload failed: ", LangHI: "फ़ोटो अपलोड विफल: "},

	// -- AI / search --
	"summary_prep_failed":         {LangEN: "failed to prepare summary for insight generation", LangHI: "इनसाइट जनरेट करने के लिए सारांश तैयार करने में विफल"},
	"search_bad_format":           {LangEN: "search assistant returned an unexpected format", LangHI: "खोज सहायक ने एक अप्रत्याशित प्रारूप लौटाया"},
	"search_assistant_unavailable": {LangEN: "search assistant unavailable: ", LangHI: "खोज सहायक अनुपलब्ध है: "},
	"ai_summary_unavailable":      {LangEN: "AI summary unavailable right now: ", LangHI: "एआई सारांश अभी अनुपलब्ध है: "},

	// -- generic DB error classification (utils/dberrors.go) --
	"resource_exists": {LangEN: "resource already exists", LangHI: "यह संसाधन पहले से मौजूद है"},
	"fk_violation":    {LangEN: "referenced record does not exist", LangHI: "संदर्भित रिकॉर्ड मौजूद नहीं है"},
	"unexpected_error": {LangEN: "something went wrong — please try again", LangHI: "कुछ गलत हो गया — कृपया पुनः प्रयास करें"},

	// -- success messages --
	"account_deleted":     {LangEN: "account deleted", LangHI: "खाता हटा दिया गया"},
	"company_deleted":     {LangEN: "company deleted", LangHI: "कंपनी हटा दी गई"},
	"member_added":        {LangEN: "member added", LangHI: "सदस्य जोड़ा गया"},
	"member_removed":      {LangEN: "member removed", LangHI: "सदस्य हटाया गया"},
	"member_role_updated": {LangEN: "member role updated", LangHI: "सदस्य की भूमिका अपडेट की गई"},
	"user_deleted":        {LangEN: "user deleted", LangHI: "उपयोगकर्ता हटाया गया"},
}

// LangFromContext reads the requester's language, set by AuthRequired from
// their profile. Defaults to English for unauthenticated requests (signup/
// signin, before there's a user row to read a preference from) or if
// something went wrong resolving it.
func LangFromContext(c *gin.Context) Lang {
	if c == nil {
		return LangEN
	}
	if v, ok := c.Get("lang"); ok {
		if l, ok := v.(Lang); ok {
			return l
		}
	}
	return LangEN
}

// Msg returns the message for key in the requester's language, falling
// back to English if that language's translation is missing, and to the
// key itself if the key isn't in the catalog at all — so a missing
// translation shows up as an obvious ugly string during development
// instead of silently rendering blank.
func Msg(c *gin.Context, key string) string {
	lang := LangFromContext(c)
	if m, ok := messages[key]; ok {
		if s, ok := m[lang]; ok {
			return s
		}
		return m[LangEN]
	}
	return key
}
