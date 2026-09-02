import { createContext, useContext, useState, useEffect, useCallback } from 'react'

// Every user-facing string in the app lives here, in English and Hindi.
// Components never hardcode text — they call t('key') so a user's language
// choice actually changes everything they see, not just some of it.
//
// Money amounts are deliberately NOT translated into Devanagari numerals —
// that's not how Hindi-language Indian fintech apps actually format
// currency in practice (PhonePe, GPay, etc. all keep ₹1,000 as-is in
// Hindi mode too). Only the surrounding text changes.
const DICTIONARY = {
  en: {
    // -- top bar --
    theme_to_light: 'Switch to light mode',
    theme_to_dark: 'Switch to dark mode',
    lang_switch_title: 'हिंदी में बदलें',
    edit_profile: 'Edit your profile',
    sign_out: 'Sign out',

    // -- auth screen --
    tagline: 'A ledger for money that moves — built to be read, not just trusted.',
    principle_1: 'Keep every bank and cash account, across every company you run, in one place.',
    principle_2: 'Move money between accounts and track its status from pending to completed.',
    principle_3: 'Type something like "pending transfers over 5000" into search to filter instantly.',
    sign_in: 'Sign in',
    sign_up: 'Sign up',
    name_label: 'Name',
    email_label: 'Email',
    password_label: 'Password',
    working: 'Working…',
    create_account_btn: 'Create account',

    // -- dashboard --
    your_companies: 'Your companies',
    on_record: '{n} on record',
    matching: ', {n} matching "{q}"',
    filter_placeholder: 'Filter by name…',
    insights_title: 'Insights',
    thinking: 'Thinking…',
    refresh: 'Refresh',
    generate: 'Generate',
    cached_hint_title: "Nothing has changed since the last time this was generated, so this is reused rather than a fresh AI call",
    cached_label: '⚡ cached',
    overview_insight_hint: "AI-written summary across every company you belong to — total activity, which companies are busiest, and which have none yet.",
    loading: 'Loading…',
    opened_on: 'opened {date}',
    create: 'Create',
    cancel: 'Cancel',
    new_company: 'New company',
    company_name_placeholder: 'Company name…',

    // -- company view --
    all_companies_back: '← All companies',
    balance: 'Balance',
    accounts_title: 'Accounts',
    active_of: '{active}/{total} active',
    transfers_title: 'Transfers',
    members_title: 'Members',
    add_member: '+ Add member',
    demote: 'demote',
    make_admin: 'make admin',
    add: 'Add',
    admin_hint: "You're an admin — you can add, remove, and promote members. A company always needs at least one admin.",
    member_hint: 'Only people added here can see this company. Ask an admin to add or remove members.',
    company_insight_hint: "AI-written summary of this company's transfer activity, from real computed numbers.",
    search_transfers: 'Search transfers',
    search_placeholder: '"completed transfers over 100"',
    search_btn: 'Search',
    interpreted: 'interpreted:',
    no_filters: 'no filters',
    clear: 'clear',
    active_pill: 'active',
    inactive_pill: 'inactive',
    deactivate: 'Deactivate',
    reactivate: 'Reactivate',
    low_balance_suggestion: 'Balance is under ₹{n} — consider deactivating.',
    recovered_suggestion: 'Balance has recovered — consider reactivating.',
    deactivate_now: 'Deactivate now',
    reactivate_now: 'Reactivate now',
    balance_placeholder: 'Balance',
    open_btn: 'Open',
    new_account: 'New account',
    from_placeholder: 'from…',
    to_placeholder: 'to: paste account ID…',
    amount_placeholder: 'Amount',
    note_placeholder: 'Note (optional)',
    send: 'Send',
    will_be_recorded: 'Will be recorded as {type} — detected automatically from the two accounts\' types.',
    type_auto_detect_hint: 'The transfer type (bank/cash) is detected automatically from the accounts involved — no need to pick it.',
    no_transfers: 'No transfers to show.',
    col_date: 'Date',
    col_type: 'Type',
    col_route: 'Route',
    col_status: 'Status',
    col_amount: 'Amount',
    view_details_title: 'View details',
    pending_proposed_title: "A reversal has been proposed and is awaiting the other company's decision",
    proposed_label: '↺ proposed',
    admin_title: 'Admin',

    account_type_BANK: 'BANK',
    account_type_CASH: 'CASH',
    transfer_type_BANK_TO_BANK: 'Bank to Bank Transfer',
    transfer_type_CASH_DEPOSIT: 'Cash Deposit in Bank',
    transfer_type_CASH_WITHDRAWAL: 'Cash Withdrawal from Bank',
    transfer_type_CASH_ACCOUNT: 'Cash Account Transfer',
    status_PENDING: 'PENDING',
    status_COMPLETED: 'COMPLETED',
    status_CANCELLED: 'CANCELLED',
    status_REVERSED: 'REVERSED',

    // -- transfer detail modal --
    transfer_details_title: 'Transfer details',
    amount_label: 'Amount',
    type_label: 'Type',
    from_label: 'From',
    to_label: 'To',
    note_label: 'Note',
    none: 'none',
    created_label: 'Created',
    last_updated_label: 'Last updated',
    status_label: 'Status',
    waiting_receiver: 'Waiting for the receiving company to approve this transfer. No money has moved yet.',
    cancel_request: 'Cancel request',
    needs_your_approval: 'This transfer needs your approval before any money moves.',
    approve: 'Approve',
    reject: 'Reject',
    you_proposed_word: 'you',
    proposed_reversal_msg: 'This reversal was proposed by {who}. Waiting for the other company to respond — the money hasn\'t moved.',
    other_wants_reverse: 'The other company wants to reverse this transfer.',
    approve_reversal: 'Approve reversal',
    propose_reversing: 'Propose reversing this transfer',
    withdraw_proposal: 'Withdraw proposal',

    // -- profile modal --
    your_profile_title: 'Your profile',
    invalid_image_type: 'Please choose a JPEG, PNG, WEBP, or GIF image.',
    image_too_large: 'That image is too large — please choose one under 5MB.',
    change_photo: 'Change photo',
    upload_photo: 'Upload photo',
    remove: 'Remove',
    saving: 'Saving…',
    save_changes: 'Save changes',
    language_label: 'Language',
    change_password_title: 'Change password',
    current_password_label: 'Current password',
    new_password_label: 'New password (min. 8 characters)',
    change_password_btn: 'Change password',
    password_changed_msg: 'Password changed.',
    forgot_password_link: 'Forgot password?',
    back_to_sign_in: '← Back to sign in',
    reset_password_email_label: 'Enter your email and we\u2019ll send you a reset link.',
    send_reset_link: 'Send reset link',
    reset_link_sent_msg: 'If that email exists, a reset link has been sent. Check your inbox.',
    reset_password_title: 'Reset your password',
    new_password_field_label: 'New password (min. 8 characters)',
    reset_password_btn: 'Reset password',
    reset_password_success_msg: 'Password reset. You can sign in with your new password now.',
    invalid_reset_link_msg: 'This link is invalid or has expired. Please request a new one.',
    verifying_email_msg: 'Verifying your email…',
    email_verified_success_msg: 'Email verified — thanks!',
    verify_email_banner: 'Please verify your email address.',
    resend_verification_link: 'Resend email',
    verification_resent_msg: 'Verification email sent — check your inbox.',
    dismiss: 'Dismiss',
    lang_name_en: 'English',
    lang_name_hi: 'हिंदी (Hindi)',

    // -- shared --
    confirm_delete: 'Confirm {label} deletion?',
    delete_account_label: 'account',
    delete_company_label: 'company',
    delete_member_label: 'member',
    click_to_copy: 'Click to copy ID',
    copied: 'Copied',
  },
  hi: {
    theme_to_light: 'लाइट मोड में बदलें',
    theme_to_dark: 'डार्क मोड में बदलें',
    lang_switch_title: 'Switch to English',
    edit_profile: 'अपनी प्रोफ़ाइल संपादित करें',
    sign_out: 'साइन आउट',

    tagline: 'पैसों की हर हलचल का हिसाब — भरोसे पर नहीं, पढ़ने पर आधारित।',
    principle_1: 'अपनी हर कंपनी के बैंक और कैश खाते एक ही जगह रखें।',
    principle_2: 'खातों के बीच पैसे भेजें और उसकी स्थिति लंबित से पूर्ण तक ट्रैक करें।',
    principle_3: '"5000 से ज़्यादा के लंबित ट्रांसफर" जैसा कुछ खोज में लिखें और तुरंत फ़िल्टर करें।',
    sign_in: 'साइन इन',
    sign_up: 'साइन अप',
    name_label: 'नाम',
    email_label: 'ईमेल',
    password_label: 'पासवर्ड',
    working: 'कार्य जारी है…',
    create_account_btn: 'खाता बनाएं',

    your_companies: 'आपकी कंपनियां',
    on_record: '{n} दर्ज',
    matching: ', "{q}" से {n} मेल खाती हैं',
    filter_placeholder: 'नाम से फ़िल्टर करें…',
    insights_title: 'इनसाइट्स',
    thinking: 'सोच रहे हैं…',
    refresh: 'रीफ़्रेश',
    generate: 'जनरेट करें',
    cached_hint_title: 'पिछली बार जनरेट होने के बाद कुछ भी नहीं बदला, इसलिए नया एआई कॉल करने के बजाय इसे दोबारा उपयोग किया गया',
    cached_label: '⚡ कैश्ड',
    overview_insight_hint: 'आपकी सभी कंपनियों का एआई-लिखित सारांश — कुल गतिविधि, सबसे व्यस्त कंपनियां, और जिनमें अभी तक कोई गतिविधि नहीं हुई।',
    loading: 'लोड हो रहा है…',
    opened_on: '{date} को खोली गई',
    create: 'बनाएं',
    cancel: 'रद्द करें',
    new_company: 'नई कंपनी',
    company_name_placeholder: 'कंपनी का नाम…',

    all_companies_back: '← सभी कंपनियां',
    balance: 'बैलेंस',
    accounts_title: 'खाते',
    active_of: '{active}/{total} सक्रिय',
    transfers_title: 'ट्रांसफर',
    members_title: 'सदस्य',
    add_member: '+ सदस्य जोड़ें',
    demote: 'पदावनत करें',
    make_admin: 'एडमिन बनाएं',
    add: 'जोड़ें',
    admin_hint: 'आप एडमिन हैं — आप सदस्य जोड़, हटा और प्रमोट कर सकते हैं। किसी भी कंपनी में हमेशा कम से कम एक एडमिन होना ज़रूरी है।',
    member_hint: 'केवल यहां जोड़े गए लोग ही यह कंपनी देख सकते हैं। सदस्य जोड़ने या हटाने के लिए किसी एडमिन से कहें।',
    company_insight_hint: 'वास्तविक गणना किए गए आंकड़ों से, इस कंपनी की ट्रांसफर गतिविधि का एआई-लिखित सारांश।',
    search_transfers: 'ट्रांसफर खोजें',
    search_placeholder: '"100 से ज़्यादा के पूर्ण ट्रांसफर"',
    search_btn: 'खोजें',
    interpreted: 'समझा गया:',
    no_filters: 'कोई फ़िल्टर नहीं',
    clear: 'साफ़ करें',
    active_pill: 'सक्रिय',
    inactive_pill: 'निष्क्रिय',
    deactivate: 'निष्क्रिय करें',
    reactivate: 'पुनः सक्रिय करें',
    low_balance_suggestion: 'बैलेंस ₹{n} से कम है — निष्क्रिय करने पर विचार करें।',
    recovered_suggestion: 'बैलेंस फिर से बढ़ गया है — पुनः सक्रिय करने पर विचार करें।',
    deactivate_now: 'अभी निष्क्रिय करें',
    reactivate_now: 'अभी पुनः सक्रिय करें',
    balance_placeholder: 'बैलेंस',
    open_btn: 'खोलें',
    new_account: 'नया खाता',
    from_placeholder: 'से…',
    to_placeholder: 'प्रति: खाता आईडी पेस्ट करें…',
    amount_placeholder: 'राशि',
    note_placeholder: 'नोट (वैकल्पिक)',
    send: 'भेजें',
    will_be_recorded: 'इसे {type} के रूप में दर्ज किया जाएगा — दोनों खातों के प्रकार से स्वतः पहचाना गया।',
    type_auto_detect_hint: 'ट्रांसफर का प्रकार (बैंक/कैश) खातों से स्वतः पहचाना जाता है — इसे चुनने की ज़रूरत नहीं।',
    no_transfers: 'दिखाने के लिए कोई ट्रांसफर नहीं है।',
    col_date: 'तारीख़',
    col_type: 'प्रकार',
    col_route: 'मार्ग',
    col_status: 'स्थिति',
    col_amount: 'राशि',
    view_details_title: 'विवरण देखें',
    pending_proposed_title: 'उलटाव प्रस्तावित किया गया है और दूसरी कंपनी के निर्णय की प्रतीक्षा है',
    proposed_label: '↺ प्रस्तावित',
    admin_title: 'एडमिन',

    account_type_BANK: 'बैंक',
    account_type_CASH: 'कैश',
    transfer_type_BANK_TO_BANK: 'बैंक से बैंक ट्रांसफर',
    transfer_type_CASH_DEPOSIT: 'बैंक में कैश जमा',
    transfer_type_CASH_WITHDRAWAL: 'बैंक से कैश निकासी',
    transfer_type_CASH_ACCOUNT: 'कैश खाता ट्रांसफर',
    status_PENDING: 'लंबित',
    status_COMPLETED: 'पूर्ण',
    status_CANCELLED: 'रद्द',
    status_REVERSED: 'उलटा',

    transfer_details_title: 'ट्रांसफर विवरण',
    amount_label: 'राशि',
    type_label: 'प्रकार',
    from_label: 'प्रेषक',
    to_label: 'प्राप्तकर्ता',
    note_label: 'नोट',
    none: 'कोई नहीं',
    created_label: 'बनाया गया',
    last_updated_label: 'अंतिम अपडेट',
    status_label: 'स्थिति',
    waiting_receiver: 'प्राप्तकर्ता कंपनी की स्वीकृति की प्रतीक्षा है। अभी तक कोई पैसा स्थानांतरित नहीं हुआ है।',
    cancel_request: 'अनुरोध रद्द करें',
    needs_your_approval: 'पैसा स्थानांतरित होने से पहले इस ट्रांसफर को आपकी स्वीकृति चाहिए।',
    approve: 'स्वीकृत करें',
    reject: 'अस्वीकार करें',
    you_proposed_word: 'आप',
    proposed_reversal_msg: 'यह उलटाव {who} द्वारा प्रस्तावित किया गया है। दूसरी कंपनी के जवाब की प्रतीक्षा है — पैसा अभी नहीं हिला है।',
    other_wants_reverse: 'दूसरी कंपनी इस ट्रांसफर को उलटना चाहती है।',
    approve_reversal: 'उलटाव स्वीकृत करें',
    propose_reversing: 'इस ट्रांसफर को उलटने का प्रस्ताव रखें',
    withdraw_proposal: 'प्रस्ताव वापस लें',

    your_profile_title: 'आपकी प्रोफ़ाइल',
    invalid_image_type: 'कृपया JPEG, PNG, WEBP, या GIF छवि चुनें।',
    image_too_large: 'यह छवि बहुत बड़ी है — कृपया 5MB से छोटी छवि चुनें।',
    change_photo: 'फ़ोटो बदलें',
    upload_photo: 'फ़ोटो अपलोड करें',
    remove: 'हटाएं',
    saving: 'सहेजा जा रहा है…',
    save_changes: 'बदलाव सहेजें',
    language_label: 'भाषा',
    change_password_title: 'पासवर्ड बदलें',
    current_password_label: 'मौजूदा पासवर्ड',
    new_password_label: 'नया पासवर्ड (कम से कम 8 अक्षर)',
    change_password_btn: 'पासवर्ड बदलें',
    password_changed_msg: 'पासवर्ड बदल दिया गया।',
    forgot_password_link: 'पासवर्ड भूल गए?',
    back_to_sign_in: '← साइन इन पर वापस जाएं',
    reset_password_email_label: 'अपना ईमेल दर्ज करें और हम आपको एक रीसेट लिंक भेजेंगे।',
    send_reset_link: 'रीसेट लिंक भेजें',
    reset_link_sent_msg: 'अगर वह ईमेल मौजूद है, तो एक रीसेट लिंक भेज दिया गया है। अपना इनबॉक्स देखें।',
    reset_password_title: 'अपना पासवर्ड रीसेट करें',
    new_password_field_label: 'नया पासवर्ड (कम से कम 8 अक्षर)',
    reset_password_btn: 'पासवर्ड रीसेट करें',
    reset_password_success_msg: 'पासवर्ड रीसेट हो गया। अब आप अपने नए पासवर्ड से साइन इन कर सकते हैं।',
    invalid_reset_link_msg: 'यह लिंक अमान्य है या समाप्त हो गया है। कृपया एक नया अनुरोध करें।',
    verifying_email_msg: 'आपका ईमेल सत्यापित किया जा रहा है…',
    email_verified_success_msg: 'ईमेल सत्यापित हो गया — धन्यवाद!',
    verify_email_banner: 'कृपया अपना ईमेल पता सत्यापित करें।',
    resend_verification_link: 'ईमेल पुनः भेजें',
    verification_resent_msg: 'सत्यापन ईमेल भेज दिया गया — अपना इनबॉक्स देखें।',
    dismiss: 'खारिज करें',
    lang_name_en: 'English (अंग्रेज़ी)',
    lang_name_hi: 'हिंदी',

    confirm_delete: '{label} हटाने की पुष्टि करें?',
    delete_account_label: 'खाता',
    delete_company_label: 'कंपनी',
    delete_member_label: 'सदस्य',
    click_to_copy: 'आईडी कॉपी करने के लिए क्लिक करें',
    copied: 'कॉपी हो गया',
  },
}

// Maps the raw transfer_type strings the backend actually stores/returns
// (fixed English enum values — never translated at the data layer, only
// for display) to their translation keys. Shared by every component that
// displays a transfer's type.
export const TRANSFER_TYPE_KEYS = {
  'BANK TO BANK TRANSFER': 'transfer_type_BANK_TO_BANK',
  'CASH DEPOSIT IN BANK': 'transfer_type_CASH_DEPOSIT',
  'CASH WITHDRAWAL FROM BANK': 'transfer_type_CASH_WITHDRAWAL',
  'CASH ACCOUNT TRANSFER': 'transfer_type_CASH_ACCOUNT',
}

const LanguageContext = createContext({ lang: 'en', setLang: () => {}, t: (k) => k })

function resolveInitialLang() {
  const saved = localStorage.getItem('lekha_lang')
  if (saved === 'en' || saved === 'hi') return saved
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('hi') ? 'hi' : 'en'
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(resolveInitialLang)

  useEffect(() => {
    document.documentElement.setAttribute('lang', lang)
    localStorage.setItem('lekha_lang', lang)
  }, [lang])

  const setLang = useCallback((next) => {
    if (next === 'en' || next === 'hi') setLangState(next)
  }, [])

  const t = useCallback((key, vars) => {
    let str = DICTIONARY[lang]?.[key] ?? DICTIONARY.en[key] ?? key
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.replaceAll(`{${k}}`, v)
      }
    }
    return str
  }, [lang])

  // Translates a raw transfer_type value as returned by the backend (a
  // fixed English enum string) into the current language's display label.
  const tType = useCallback((rawType) => t(TRANSFER_TYPE_KEYS[rawType] || rawType), [t])

  // Translates a raw account_type value ('BANK' / 'CASH') the same way.
  const tAccountType = useCallback((rawType) => t(`account_type_${rawType}`), [t])

  // Locale string for Intl/toLocaleDateString calls — money amounts stay
  // in standard numerals regardless of language (matches real Hindi-mode
  // fintech apps), but dates get real localization (Hindi month names etc).
  const dateLocale = lang === 'hi' ? 'hi-IN' : 'en-IN'

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, tType, tAccountType, dateLocale }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useT() {
  return useContext(LanguageContext)
}
