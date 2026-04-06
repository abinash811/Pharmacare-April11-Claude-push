import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams, useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowLeft, ChevronDown, Calendar as CalendarIcon, Stethoscope, Printer, RotateCcw, History, CreditCard } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Calendar } from '../components/ui/calendar';
import { format } from 'date-fns';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function BillingWorkspace() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { id: billId } = useParams(); // billId from route params for viewing existing bills
  const searchInputRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const printRef = useRef(null);

  // View Mode State - 'new', 'edit' (parked), 'view' (paid/due)
  const [viewMode, setViewMode] = useState('new');
  const [loadedBill, setLoadedBill] = useState(null);

  // Customer & Header State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [billedBy, setBilledBy] = useState('');
  const [paymentType, setPaymentType] = useState('cash');
  const [draftNumber, setDraftNumber] = useState(null);
  const [editingDraftId, setEditingDraftId] = useState(null);
  const [billDate, setBillDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Bill Items State
  const [billItems, setBillItems] = useState([]);
  const [newItemSearch, setNewItemSearch] = useState('');

  // Users/Staff
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  // Totals
  const [subtotal, setSubtotal] = useState(0);
  const [totalDiscount, setTotalDiscount] = useState(0);
  const [totalGst, setTotalGst] = useState(0);
  const [grandTotal, setGrandTotal] = useState(0);
  
  // Phase 3: Additional totals for sticky footer
  const [billDiscount, setBillDiscount] = useState(0);
  const [billDiscountType, setBillDiscountType] = useState('%'); // '%' or '₹'
  const [totalCess, setTotalCess] = useState(0);
  const [mrpTotal, setMrpTotal] = useState(0);
  const [margin, setMargin] = useState({ amount: 0, percent: 0 });

  // Phase 4: Finalise Modal state
  const [showFinaliseModal, setShowFinaliseModal] = useState(false);
  const [internalNote, setInternalNote] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Item 1: Schedule H warning confirmation
  const [showScheduleHWarning, setShowScheduleHWarning] = useState(false);
  
  // Item 2: Batch selection panel
  const [showBatchPanel, setShowBatchPanel] = useState(null); // index of item showing batch panel
  const [batchPanelData, setBatchPanelData] = useState([]);
  const [hidZeroStock, setHidZeroStock] = useState(true);
  const batchPanelRef = useRef(null);

  // Print State
  const [savedBillData, setSavedBillData] = useState(null);

  // Save dropdown state
  const [showSaveDropdown, setShowSaveDropdown] = useState(false);
  const saveDropdownRef = useRef(null);

  // Patient Search Modal
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [patientResults, setPatientResults] = useState([]);
  const [patientLoading, setPatientLoading] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);

  // Doctor Search
  const [showDoctorDropdown, setShowDoctorDropdown] = useState(false);
  const [doctorSearch, setDoctorSearch] = useState('');
  const [doctorResults, setDoctorResults] = useState([]);
  const [doctorLoading, setDoctorLoading] = useState(false);
  const doctorDropdownRef = useRef(null);

  // Billing For dropdown
  const [billingFor, setBillingFor] = useState('self');

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (saveDropdownRef.current && !saveDropdownRef.current.contains(event.target)) {
        setShowSaveDropdown(false);
      }
      if (doctorDropdownRef.current && !doctorDropdownRef.current.contains(event.target)) {
        setShowDoctorDropdown(false);
      }
      // Close batch panel when clicking outside
      if (batchPanelRef.current && !batchPanelRef.current.contains(event.target)) {
        setShowBatchPanel(null);
        setBatchPanelData([]);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load initial data
  useEffect(() => {
    fetchUsers();
    
    // Check if viewing an existing bill via URL param
    if (billId) {
      loadExistingBill(billId);
    } else {
      // Check if loading a draft from URL param
      const draftId = searchParams.get('draft');
      if (draftId) {
        loadDraftBill(draftId);
      } else {
        // Load local draft if exists
        const savedDraft = localStorage.getItem('billing_draft');
        if (savedDraft) {
          try {
            const draft = JSON.parse(savedDraft);
            setCustomerName(draft.customerName || '');
            setCustomerPhone(draft.customerPhone || '');
            setDoctorName(draft.doctorName || '');
            setBillItems(draft.items || []);
            setPaymentType(draft.paymentType || 'cash');
            setDraftNumber(draft.draftNumber || Math.floor(1000 + Math.random() * 9000));
          } catch (e) {
            console.error('Failed to load draft');
          }
        }
      }
    }
  }, [billId]);

  // Load an existing bill by ID
  const loadExistingBill = async (id) => {
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${API}/bills/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const bill = response.data;
      setLoadedBill(bill);
      
      // Determine view mode based on status
      const status = bill.status?.toLowerCase();
      if (status === 'parked' || status === 'draft') {
        setViewMode('edit'); // Editable - continue working on parked bill
        setEditingDraftId(bill.id);
      } else {
        setViewMode('view'); // Read-only for paid/due bills
      }
      
      // Populate form fields
      setCustomerName(bill.customer_name || 'Walk-in Customer');
      setCustomerPhone(bill.customer_mobile || bill.customer_phone || '');
      setDoctorName(bill.doctor_name || '');
      setPaymentType(bill.payment_method || bill.payment_type || 'cash');
      setBilledBy(bill.cashier_name || bill.created_by?.name || '');
      
      if (bill.bill_date || bill.created_at) {
        setBillDate(new Date(bill.bill_date || bill.created_at));
      }
      
      // Convert bill items to workspace format
      const items = (bill.items || []).map((item, index) => ({
        id: item.id || Date.now() + index,
        product_sku: item.product_sku || item.sku,
        product_name: item.product_name || item.name || item.medicine_name,
        manufacturer: item.manufacturer || '',
        composition: item.composition || '',
        batch_no: item.batch_no || item.batch_number,
        batch_id: item.batch_id,
        expiry_date: item.expiry_date,
        qty: item.quantity || item.qty,
        unit_price: item.unit_price || item.mrp,
        cost_price: item.cost_price || (item.unit_price || item.mrp) * 0.7,
        discount_percent: item.discount_percent || 0,
        gst_percent: item.gst_percent || item.gst_rate || 5,
        cess_percent: item.cess_percent || 0,
        available_qty: item.available_qty || 999,
        schedule: item.schedule || null,
        scheduleH: item.scheduleH || item.schedule === 'H' || item.schedule === 'H1',
        net_amount: item.line_total || item.net_amount || item.amount || 0
      }));
      
      setBillItems(items);
      
    } catch (error) {
      toast.error('Failed to load bill');
      console.error('Load bill error:', error);
      navigate('/billing');
    }
  };

  // Load a draft/parked bill
  const loadDraftBill = async (id) => {
    await loadExistingBill(id);
  };

  // Calculate totals whenever items or bill discount changes
  useEffect(() => {
    calculateTotals();
  }, [billItems, billDiscount, billDiscountType]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'F8') {
        e.preventDefault();
        holdBill();
      }
      if (e.key === 'F12') {
        e.preventDefault();
        saveBill(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [billItems]);

  const fetchUsers = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${API}/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(response.data || []);
      // Get current user
      const userRes = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCurrentUser(userRes.data);
      setBilledBy(userRes.data?.name || userRes.data?.email || '');
    } catch (error) {
      console.error('Failed to fetch users');
    }
  };

  // Search patients from patients collection
  const searchPatients = async (query) => {
    setPatientSearch(query);
    if (query.length < 1) {
      setPatientResults([]);
      return;
    }
    setPatientLoading(true);
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${API}/patients?search=${encodeURIComponent(query)}&page_size=20`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPatientResults(response.data.data || response.data || []);
    } catch (error) {
      console.error('Patient search error:', error);
      setPatientResults([]);
    } finally {
      setPatientLoading(false);
    }
  };

  // Select a patient from modal
  const selectPatient = (patient) => {
    if (patient === 'counter') {
      setCustomerName('Counter Sale');
      setCustomerPhone('');
      setSelectedPatient(null);
    } else {
      setCustomerName(patient.name || '');
      setCustomerPhone(patient.phone || patient.mobile || '');
      setSelectedPatient(patient);
    }
    setShowPatientModal(false);
    setPatientSearch('');
    setPatientResults([]);
    saveDraft();
  };

  // Search doctors from doctors collection
  const searchDoctors = async (query) => {
    setDoctorSearch(query);
    setDoctorName(query);
    if (query.length < 1) {
      setDoctorResults([]);
      setShowDoctorDropdown(false);
      return;
    }
    setDoctorLoading(true);
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${API}/doctors?search=${encodeURIComponent(query)}&page_size=10`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDoctorResults(response.data.data || response.data || []);
      setShowDoctorDropdown(true);
    } catch (error) {
      console.error('Doctor search error:', error);
      setDoctorResults([]);
    } finally {
      setDoctorLoading(false);
    }
  };

  // Select a doctor from dropdown
  const selectDoctor = (doctor) => {
    setDoctorName(doctor.name || '');
    setDoctorSearch(doctor.name || '');
    setShowDoctorDropdown(false);
    setDoctorResults([]);
    saveDraft();
  };

  // Item 2: Fetch batches for batch selection panel
  const openBatchPanel = async (index) => {
    const item = billItems[index];
    const token = localStorage.getItem('token');
    
    try {
      // Fetch all batches for this product directly from stock_batches
      const response = await axios.get(`${API}/stock/batches?product_sku=${encodeURIComponent(item.product_sku)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const batches = response.data || [];
      
      if (batches.length > 0) {
        setBatchPanelData(batches);
        setShowBatchPanel(index);
      } else {
        toast.info('No additional batches found for this product');
      }
    } catch (error) {
      console.error('Failed to fetch batches:', error);
      // If API fails, try the inventory endpoint as fallback
      try {
        const fallbackResponse = await axios.get(`${API}/inventory/search?q=${encodeURIComponent(item.product_sku)}&page_size=1`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const products = fallbackResponse.data.data || fallbackResponse.data || [];
        const product = products.find(p => p.product?.sku === item.product_sku);
        if (product && product.batches && product.batches.length > 0) {
          setBatchPanelData(product.batches);
          setShowBatchPanel(index);
        } else {
          toast.info('No additional batches available');
        }
      } catch (fallbackError) {
        toast.error('Failed to load batch data');
      }
    }
  };

  // Item 2: Select a batch from the panel
  const selectBatch = (index, batch) => {
    const updatedItems = [...billItems];
    updatedItems[index] = {
      ...updatedItems[index],
      batch_id: batch.id,
      batch_no: batch.batch_no,
      expiry_date: batch.expiry_date,
      unit_price: batch.mrp_per_unit || batch.mrp || updatedItems[index].unit_price,
      cost_price: batch.cost_price_per_unit || batch.ptr_per_unit || updatedItems[index].cost_price,
      available_qty: batch.qty_on_hand,
      discount_percent: batch.discount_percent || updatedItems[index].discount_percent
    };
    
    // Recalculate net amount
    const baseAmount = updatedItems[index].qty * updatedItems[index].unit_price;
    const discountAmount = baseAmount * (updatedItems[index].discount_percent / 100);
    const afterDiscount = baseAmount - discountAmount;
    const gstAmount = afterDiscount * (updatedItems[index].gst_percent / 100);
    updatedItems[index].net_amount = afterDiscount + gstAmount;
    
    setBillItems(updatedItems);
    setShowBatchPanel(null);
    setBatchPanelData([]);
    saveDraft();
  };

  // Item 1: Check if any Schedule H drug is in the bill
  const hasScheduleHDrug = () => {
    return billItems.some(item => item.schedule === 'H' || item.schedule === 'H1' || item.scheduleH === true);
  };

  // Item 1: Check if prescription reference exists
  const hasPrescriptionReference = () => {
    return doctorName && doctorName.trim().length > 0;
  };

  const handleSearch = async (query) => {
    setSearchQuery(query);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setSearchLoading(true);
      const token = localStorage.getItem('token');
      try {
        const response = await axios.get(`${API}/products/search-with-batches?q=${encodeURIComponent(query)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSearchResults(response.data);
        setShowSearchResults(true);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  };

  const addItemToBill = (product, batch) => {
    const existingIndex = billItems.findIndex(
      item => item.product_sku === product.sku && item.batch_no === batch.batch_no
    );

    if (existingIndex >= 0) {
      // Update quantity
      const updatedItems = [...billItems];
      updatedItems[existingIndex].qty += 1;
      updatedItems[existingIndex].net_amount = calculateItemTotal(updatedItems[existingIndex]);
      setBillItems(updatedItems);
    } else {
      // Add new item with Schedule H flag
      const newItem = {
        id: Date.now(),
        product_sku: product.sku,
        product_name: product.name,
        manufacturer: product.manufacturer || '',
        composition: product.composition || product.generic_name || '',
        batch_no: batch.batch_no,
        batch_id: batch.id,
        expiry_date: batch.expiry_date,
        qty: 1,
        unit_price: batch.mrp_per_unit || product.default_mrp || 0,
        cost_price: batch.cost_price_per_unit || batch.ptr_per_unit || (batch.mrp_per_unit || 0) * 0.7,
        discount_percent: batch.discount_percent || 0,
        gst_percent: product.gst_percent || 5,
        cess_percent: product.cess_percent || 0,
        available_qty: batch.qty_on_hand || 0,
        // Schedule H flag for Rx required warning
        schedule: product.schedule || null,
        scheduleH: product.scheduleH || product.schedule === 'H' || product.schedule === 'H1',
        net_amount: 0
      };
      newItem.net_amount = calculateItemTotal(newItem);
      setBillItems([...billItems, newItem]);
    }

    setSearchQuery('');
    setShowSearchResults(false);
    saveDraft();
  };

  const calculateItemTotal = (item) => {
    const baseAmount = item.qty * item.unit_price;
    const discountAmount = baseAmount * (item.discount_percent / 100);
    const afterDiscount = baseAmount - discountAmount;
    const gstAmount = afterDiscount * (item.gst_percent / 100);
    return afterDiscount + gstAmount;
  };

  const updateItem = (index, field, value) => {
    const updatedItems = [...billItems];
    updatedItems[index][field] = value;
    updatedItems[index].net_amount = calculateItemTotal(updatedItems[index]);
    setBillItems(updatedItems);
    saveDraft();
  };

  const removeItem = (index) => {
    const updatedItems = billItems.filter((_, i) => i !== index);
    setBillItems(updatedItems);
    saveDraft();
  };

  const calculateTotals = () => {
    let mrp = 0; // MRP total (qty * MRP per unit)
    let itemDisc = 0; // Item-level discounts
    let gst = 0;
    let cess = 0;
    let costPrice = 0; // For margin calculation

    billItems.forEach(item => {
      const baseAmount = item.qty * item.unit_price;
      const itemDiscAmount = baseAmount * (item.discount_percent / 100);
      const afterDiscount = baseAmount - itemDiscAmount;
      const itemGst = afterDiscount * (item.gst_percent / 100);
      const itemCess = afterDiscount * ((item.cess_percent || 0) / 100);
      
      mrp += baseAmount;
      itemDisc += itemDiscAmount;
      gst += itemGst;
      cess += itemCess;
      
      // Estimate cost price (70% of MRP if not available)
      costPrice += item.qty * (item.cost_price || item.unit_price * 0.7);
    });

    // Calculate bill-level discount
    let billDiscAmount = 0;
    const afterItemDiscount = mrp - itemDisc;
    if (billDiscount > 0) {
      if (billDiscountType === '%') {
        billDiscAmount = afterItemDiscount * (billDiscount / 100);
      } else {
        billDiscAmount = billDiscount;
      }
    }

    // Calculate final totals
    const subtotalValue = mrp - itemDisc - billDiscAmount;
    const grandTotalValue = subtotalValue + gst + cess;
    
    // Margin calculation
    const marginAmount = subtotalValue - costPrice;
    const marginPercent = costPrice > 0 ? (marginAmount / costPrice) * 100 : 0;

    setMrpTotal(mrp);
    setSubtotal(subtotalValue);
    setTotalDiscount(itemDisc + billDiscAmount);
    setTotalGst(gst);
    setTotalCess(cess);
    setGrandTotal(grandTotalValue);
    setMargin({ amount: marginAmount, percent: marginPercent });
  };

  const saveDraft = () => {
    const draft = {
      customerName,
      customerPhone,
      doctorName,
      paymentType,
      items: billItems,
      draftNumber: draftNumber || Math.floor(1000 + Math.random() * 9000)
    };
    localStorage.setItem('billing_draft', JSON.stringify(draft));
    if (!draftNumber) {
      setDraftNumber(draft.draftNumber);
    }
  };

  const holdBill = () => {
    saveDraft();
    toast.success('Bill held successfully');
  };

  const clearBill = () => {
    setBillItems([]);
    setCustomerName('');
    setCustomerPhone('');
    setDoctorName('');
    setPaymentType('cash');
    localStorage.removeItem('billing_draft');
    setDraftNumber(null);
    toast.info('Bill cleared');
  };

  const saveBill = async (saveAsDraft = false) => {
    if (billItems.length === 0) {
      toast.error('Add items to bill first');
      return;
    }

    const token = localStorage.getItem('token');
    try {
      // Determine status based on saveAsDraft flag or payment type
      let billStatus;
      if (saveAsDraft) {
        billStatus = 'draft';
      } else {
        billStatus = paymentType === 'credit' ? 'due' : 'paid';
      }

      const billData = {
        customer_name: customerName || 'Walk-in Customer',
        customer_mobile: customerPhone,
        doctor_name: doctorName,
        payment_method: paymentType,
        items: billItems.map(item => ({
          product_sku: item.product_sku,
          product_name: item.product_name,
          batch_no: item.batch_no,
          quantity: item.qty,
          unit_price: item.unit_price,
          discount_percent: item.discount_percent,
          gst_percent: item.gst_percent,
          line_total: item.net_amount
        })),
        discount: totalDiscount,
        tax_rate: billItems.length > 0 ? billItems[0].gst_percent : 5,
        status: billStatus
      };

      const response = await axios.post(`${API}/bills`, billData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (saveAsDraft) {
        toast.success(`Draft saved! ID: ${response.data.bill_number}`);
      } else {
        toast.success(`Bill #${response.data.bill_number} created successfully!`);
      }
      
      localStorage.removeItem('billing_draft');
      
      // Clear bill and navigate to sales page
      clearBill();
      navigate('/billing');
      
    } catch (error) {
      toast.error(saveAsDraft ? 'Failed to save draft' : 'Failed to save bill');
      console.error('Save error:', error);
    }
  };

  const handleSaveAsDraft = () => {
    setShowSaveDropdown(false);
    saveBill(true);
  };

  // Save & Print - saves the bill then triggers print
  const saveBillAndPrint = async () => {
    if (billItems.length === 0) {
      toast.error('Add items to bill first');
      return;
    }

    const token = localStorage.getItem('token');
    try {
      const billStatus = paymentType === 'credit' ? 'due' : 'paid';
      const billData = {
        customer_name: customerName || 'Walk-in Customer',
        customer_mobile: customerPhone,
        doctor_name: doctorName,
        payment_method: paymentType,
        items: billItems.map(item => ({
          product_sku: item.product_sku,
          product_name: item.product_name,
          batch_no: item.batch_no,
          quantity: item.qty,
          unit_price: item.unit_price,
          discount_percent: item.discount_percent,
          gst_percent: item.gst_percent,
          line_total: item.net_amount
        })),
        discount: totalDiscount,
        tax_rate: billItems.length > 0 ? billItems[0].gst_percent : 5,
        status: billStatus
      };

      const response = await axios.post(`${API}/bills`, billData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success(`Bill #${response.data.bill_number} created!`);
      
      // Store bill data for printing
      setSavedBillData({
        bill_number: response.data.bill_number,
        items: billItems,
        customer_name: customerName || 'Walk-in Customer',
        customer_phone: customerPhone,
        doctor_name: doctorName,
        payment_method: paymentType,
        subtotal,
        total_discount: totalDiscount,
        total_gst: totalGst,
        grand_total: grandTotal
      });
      
      localStorage.removeItem('billing_draft');
      
      // Trigger print after a short delay
      setTimeout(() => {
        window.print();
        clearBill();
        navigate('/billing');
      }, 200);
      
    } catch (error) {
      toast.error('Failed to save bill');
      console.error('Save error:', error);
    }
  };

  // Park bill - saves as parked (resumable draft, no stock deduction)
  const parkBill = async () => {
    if (billItems.length === 0) {
      toast.error('Add items to bill first');
      return;
    }

    const token = localStorage.getItem('token');
    try {
      const billData = {
        customer_name: customerName || 'Walk-in Customer',
        customer_mobile: customerPhone,
        doctor_name: doctorName,
        payment_method: paymentType || 'cash',
        items: billItems.map(item => ({
          product_sku: item.product_sku,
          product_name: item.product_name,
          batch_no: item.batch_no,
          quantity: item.qty,
          unit_price: item.unit_price,
          discount_percent: item.discount_percent,
          gst_percent: item.gst_percent,
          line_total: item.net_amount
        })),
        discount: totalDiscount,
        tax_rate: billItems.length > 0 ? billItems[0].gst_percent : 5,
        status: 'draft'  // Parked = draft status
      };

      const response = await axios.post(`${API}/bills`, billData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success(`Bill parked! Can be resumed later.`);
      localStorage.removeItem('billing_draft');
      clearBill();
      navigate('/billing');
      
    } catch (error) {
      toast.error('Failed to park bill');
      console.error('Park error:', error);
    }
  };

  // Save & Deliver - saves the bill and triggers delivery booking
  const saveBillAndDeliver = async () => {
    if (billItems.length === 0) {
      toast.error('Add items to bill first');
      return;
    }

    const token = localStorage.getItem('token');
    try {
      const billStatus = paymentType === 'credit' ? 'due' : 'paid';
      const billData = {
        customer_name: customerName || 'Walk-in Customer',
        customer_mobile: customerPhone,
        doctor_name: doctorName,
        payment_method: paymentType,
        items: billItems.map(item => ({
          product_sku: item.product_sku,
          product_name: item.product_name,
          batch_no: item.batch_no,
          quantity: item.qty,
          unit_price: item.unit_price,
          discount_percent: item.discount_percent,
          gst_percent: item.gst_percent,
          line_total: item.net_amount
        })),
        discount: totalDiscount,
        tax_rate: billItems.length > 0 ? billItems[0].gst_percent : 5,
        status: billStatus,
        delivery_requested: true
      };

      const response = await axios.post(`${API}/bills`, billData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success(`Bill #${response.data.bill_number} created! Delivery booking initiated.`);
      localStorage.removeItem('billing_draft');
      clearBill();
      navigate('/billing');
      
    } catch (error) {
      toast.error('Failed to save bill');
      console.error('Save error:', error);
    }
  };

  // Open Finalise Modal
  const openFinaliseModal = () => {
    if (billItems.length === 0) {
      toast.error('Add items to bill first');
      return;
    }
    if (!paymentType) {
      toast.error('Select a payment method');
      return;
    }
    
    // Item 1: Check for Schedule H drugs without prescription
    if (hasScheduleHDrug() && !hasPrescriptionReference()) {
      setShowScheduleHWarning(true);
      return;
    }
    
    setShowFinaliseModal(true);
  };

  // Item 1: Proceed after Schedule H warning
  const proceedAfterScheduleHWarning = () => {
    setShowScheduleHWarning(false);
    setShowFinaliseModal(true);
  };

  // Confirm & Save Bill (atomic operation)
  const confirmAndSaveBill = async () => {
    setIsSaving(true);
    const token = localStorage.getItem('token');
    
    try {
      // Calculate bill-level discount amount
      let billDiscAmount = 0;
      if (billDiscount > 0) {
        if (billDiscountType === '%') {
          billDiscAmount = (mrpTotal - (totalDiscount - billDiscount)) * (billDiscount / 100);
        } else {
          billDiscAmount = billDiscount;
        }
      }

      const billStatus = paymentType === 'credit' ? 'due' : 'paid';
      const billData = {
        customer_name: customerName || 'Walk-in Customer',
        customer_mobile: customerPhone,
        doctor_name: doctorName,
        payment_method: paymentType,
        items: billItems.map(item => ({
          product_sku: item.product_sku,
          product_name: item.product_name,
          batch_no: item.batch_no,
          quantity: item.qty,
          unit_price: item.unit_price,
          discount_percent: item.discount_percent,
          gst_percent: item.gst_percent,
          cess_percent: item.cess_percent || 0,
          line_total: item.net_amount,
          cost_price: item.cost_price || item.unit_price * 0.7
        })),
        // Full snapshot of amounts
        mrp_total: mrpTotal,
        item_discount: totalDiscount - billDiscAmount,
        bill_discount: billDiscAmount,
        discount: totalDiscount,
        gst_amount: totalGst,
        cgst_amount: totalGst / 2, // Split for GST compliance
        sgst_amount: totalGst / 2,
        cess_amount: totalCess,
        margin_amount: margin.amount,
        margin_percent: margin.percent,
        tax_rate: billItems.length > 0 ? billItems[0].gst_percent : 5,
        total_amount: grandTotal,
        grand_total: grandTotal,
        round_off: 0, // Can be calculated if needed
        internal_note: internalNote,
        delivery_note: deliveryNote,
        status: billStatus,
        billed_by: billedBy,
        cashier_name: billedBy
      };

      // Atomic save: bill saved to DB + stock deducted per batch
      const response = await axios.post(`${API}/bills`, billData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success(`Bill #${response.data.bill_number} created successfully!`);
      localStorage.removeItem('billing_draft');
      
      // Close modal and navigate
      setShowFinaliseModal(false);
      clearBill();
      navigate('/billing');
      
    } catch (error) {
      // Backend handles rollback if any step fails
      toast.error(error.response?.data?.detail || 'Failed to save bill. Transaction rolled back.');
      console.error('Save error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrintCurrentBill = () => {
    if (billItems.length === 0) {
      toast.error('Add items to bill first');
      return;
    }
    
    // Store current bill data for printing
    setSavedBillData({
      bill_number: draftNumber ? `DRAFT-${draftNumber}` : 'PREVIEW',
      items: billItems,
      customer_name: customerName || 'Walk-in Customer',
      customer_phone: customerPhone,
      doctor_name: doctorName,
      payment_method: paymentType,
      subtotal,
      total_discount: totalDiscount,
      total_gst: totalGst,
      grand_total: grandTotal
    });
    
    // Trigger print
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const isExpiringSoon = (expiryDate) => {
    if (!expiryDate) return false;
    const expiry = new Date(expiryDate);
    const now = new Date();
    const diffDays = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
    return diffDays <= 90 && diffDays > 0;
  };

  const isExpired = (expiryDate) => {
    if (!expiryDate) return false;
    return new Date(expiryDate) < new Date();
  };

  const formatExpiry = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '-';
      return `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
    } catch {
      return '-';
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50" style={{ fontFamily: 'Manrope, sans-serif' }}>
      {/* Header - Standard Page Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/billing')} 
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              data-testid="back-btn"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-0.5">
                <Link to="/billing" className="hover:text-[#4682B4] transition-colors">Bills</Link>
                <span>/</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900">
                {viewMode === 'new' ? 'New Bill' : viewMode === 'edit' ? 'Continue Bill' : `#${loadedBill?.bill_number || ''}`}
              </h1>
            </div>
          </div>
          
          {/* View Mode Actions - Right side */}
          {viewMode === 'view' && loadedBill && (
            <div className="flex items-center gap-2">
              {/* Status badge */}
              {loadedBill.status === 'due' && (
                <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded">Due</span>
              )}
              {loadedBill.status === 'paid' && (
                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded">Paid</span>
              )}
              
              {/* Return indicator */}
              {loadedBill.returns && loadedBill.returns.length > 0 && (
                <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-semibold rounded">Returned</span>
              )}
              
              {/* Collect Payment button for Due bills */}
              {loadedBill.status === 'due' && (
                <button
                  onClick={() => toast.info('Collect payment functionality coming soon')}
                  className="px-4 py-2 bg-[#4682B4] text-white rounded-lg text-sm font-semibold hover:bg-[#3a6d96] flex items-center gap-2"
                  data-testid="collect-payment-btn"
                >
                  <CreditCard className="w-4 h-4" />
                  Collect Payment
                </button>
              )}
              
              {/* Return button for Paid bills */}
              {loadedBill.status === 'paid' && (!loadedBill.returns || loadedBill.returns.length === 0) && (
                <button
                  onClick={() => navigate(`/billing/returns/new?billId=${loadedBill.id}`)}
                  className="px-4 py-2 border border-orange-300 text-orange-600 rounded-lg text-sm font-semibold hover:bg-orange-50 flex items-center gap-2"
                  data-testid="return-btn"
                >
                  <RotateCcw className="w-4 h-4" />
                  Return
                </button>
              )}
              
              {/* Print button */}
              <button
                onClick={() => window.print()}
                className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 flex items-center gap-2"
                data-testid="print-btn"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
              
              {/* History button */}
              <button
                onClick={() => toast.info('History functionality coming soon')}
                className="px-3 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50"
                data-testid="history-btn"
              >
                <History className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow p-4 lg:p-6 overflow-hidden flex flex-col gap-4">
        {/* Subbar - Single Row Compact Design */}
        <section className="bg-white rounded-xl border border-slate-200 px-3 py-2 shadow-sm">
          <div className="flex items-center gap-2">
            {/* Date Picker Chip - Read-only in view mode */}
            {viewMode === 'view' ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 rounded-lg">
                <CalendarIcon className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-medium text-slate-700">
                  {format(billDate, 'dd MMM yyyy')}
                </span>
              </div>
            ) : (
              <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
                <PopoverTrigger asChild>
                  <button
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                    data-testid="date-picker-btn"
                  >
                    <CalendarIcon className="w-4 h-4 text-slate-500" />
                    <span className="text-sm font-medium text-slate-700">
                      {format(billDate, 'dd MMM yyyy')}
                    </span>
                    <ChevronDown className="w-3 h-3 text-slate-400" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={billDate}
                    onSelect={(date) => { setBillDate(date || new Date()); setShowDatePicker(false); }}
                    disabled={(date) => date > new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            )}

            {/* Patient Chip - Read-only in view mode */}
            {viewMode === 'view' ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 rounded-lg">
                <span className="material-symbols-outlined text-slate-400 text-base">person</span>
                <span className="text-sm font-medium text-slate-900">{customerName || 'Walk-in'}</span>
              </div>
            ) : (
              <button
                onClick={() => setShowPatientModal(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg hover:border-[#4682B4] transition-colors"
                data-testid="patient-chip"
              >
                <span className="material-symbols-outlined text-slate-400 text-base">person</span>
                <span className={`text-sm font-medium truncate max-w-[100px] ${customerName ? 'text-slate-900' : 'text-slate-400'}`}>
                  {customerName || 'Patient'}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>
            )}

            {/* Doctor Chip - Read-only in view mode */}
            {viewMode === 'view' ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 rounded-lg">
                <Stethoscope className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-medium text-slate-900">{doctorName || '-'}</span>
              </div>
            ) : (
              <div className="relative" ref={doctorDropdownRef}>
                <button
                  onClick={() => setShowDoctorDropdown(!showDoctorDropdown)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg hover:border-[#4682B4] transition-colors"
                  data-testid="doctor-chip"
                >
                  <Stethoscope className="w-4 h-4 text-slate-400" />
                  <span className={`text-sm font-medium truncate max-w-[100px] ${doctorName ? 'text-slate-900' : 'text-slate-400'}`}>
                    {doctorName || 'Doctor'}
                  </span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>
                {showDoctorDropdown && (
                  <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 w-64 max-h-56 overflow-hidden">
                    <div className="p-2 border-b border-slate-100">
                      <input
                        type="text"
                        placeholder="Search doctor..."
                        value={doctorSearch}
                        onChange={(e) => searchDoctors(e.target.value)}
                        className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                        autoFocus
                      />
                    </div>
                    <div className="max-h-40 overflow-y-auto">
                      {doctorLoading ? (
                        <div className="px-3 py-2 text-sm text-slate-400">Searching...</div>
                      ) : doctorResults.length > 0 ? (
                        doctorResults.map((doctor) => (
                          <button
                            key={doctor.id}
                            onClick={() => selectDoctor(doctor)}
                            className="w-full px-3 py-2 text-left hover:bg-slate-50 border-b border-slate-100 last:border-0"
                          >
                            <div className="text-sm font-medium">{doctor.name}</div>
                            <div className="text-xs text-slate-400">{doctor.registration_no || doctor.clinic_name || ''}</div>
                          </button>
                        ))
                      ) : doctorSearch.length > 0 ? (
                        <div className="px-3 py-2 text-sm text-slate-400">No doctors found</div>
                      ) : (
                        <div className="px-3 py-2 text-sm text-slate-400">Type to search doctors</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Billing For Chip - Read-only in view mode */}
            {viewMode === 'view' ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 rounded-lg">
                <span className="material-symbols-outlined text-slate-400 text-base">shopping_bag</span>
                <span className="text-sm font-medium text-slate-700">{billingFor || 'Self'}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="material-symbols-outlined text-slate-400 text-base">shopping_bag</span>
                <select
                  value={billingFor}
                  onChange={(e) => setBillingFor(e.target.value)}
                  className="text-sm font-medium text-slate-700 bg-transparent border-none focus:outline-none cursor-pointer pr-1"
                  data-testid="billing-for"
                >
                  <option value="self">Self</option>
                  <option value="other">Other</option>
                </select>
              </div>
            )}

            {/* Billed By Chip - Read-only in view mode */}
            {viewMode === 'view' ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 rounded-lg">
                <span className="material-symbols-outlined text-slate-400 text-base">badge</span>
                <span className="text-sm font-medium text-slate-700">{billedBy || currentUser?.name || '-'}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="material-symbols-outlined text-slate-400 text-base">badge</span>
                <select
                  value={billedBy}
                  onChange={(e) => setBilledBy(e.target.value)}
                  className="text-sm font-medium text-slate-700 bg-transparent border-none focus:outline-none cursor-pointer pr-1 max-w-[80px] truncate"
                  data-testid="billed-by"
                >
                  <option value={currentUser?.name || ''}>{currentUser?.name || 'User'}</option>
                  {users.filter(u => u.name !== currentUser?.name).map(user => (
                    <option key={user.id} value={user.name}>{user.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Spacer */}
            <div className="flex-grow"></div>

            {/* Payment Type - Read-only in view mode */}
            {viewMode === 'view' ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 rounded-lg">
                <span className="material-symbols-outlined text-slate-400 text-base">payments</span>
                <span className="text-sm font-medium text-slate-700 capitalize">{paymentType || '-'}</span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="material-symbols-outlined text-slate-400 text-base">payments</span>
                  <select
                    value={paymentType}
                    onChange={(e) => { setPaymentType(e.target.value); saveDraft(); }}
                    className="text-sm font-medium text-slate-700 bg-transparent border-none focus:outline-none cursor-pointer pr-1"
                    data-testid="payment-type"
                  >
                    <option value="">Payment</option>
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="credit">Credit</option>
                    <option value="card">CC/DC</option>
                    <option value="multiple">Multiple</option>
                  </select>
                </div>

                {/* Save Button with Dropdown - Only in edit/new mode */}
                <div className="relative" ref={saveDropdownRef}>
                  <div className="flex">
                    <button
                      onClick={() => saveBill(false)}
                      className="px-3 py-1.5 font-semibold text-sm text-slate-900 rounded-l-lg flex items-center gap-1.5 hover:brightness-95 transition-all"
                      style={{ backgroundColor: '#13ecda' }}
                      data-testid="save-btn"
                    >
                      <span className="material-symbols-outlined text-base">check_circle</span>
                      Save
                    </button>
                    <button
                      onClick={() => setShowSaveDropdown(!showSaveDropdown)}
                      className="px-1.5 py-1.5 text-slate-900 rounded-r-lg border-l border-slate-900/10 hover:brightness-95 transition-all"
                      style={{ backgroundColor: '#13ecda' }}
                      data-testid="save-dropdown-btn"
                    >
                      <ChevronDown className={`w-4 h-4 transition-transform ${showSaveDropdown ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                  
                  {/* Save Dropdown Menu */}
                  {showSaveDropdown && (
                    <div className="absolute top-full right-0 mt-1 w-48 bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden z-50">
                      <button
                        onClick={() => { setShowSaveDropdown(false); saveBillAndPrint(); }}
                        className="w-full px-4 py-2.5 text-left hover:bg-slate-50 flex items-center gap-3 text-sm"
                        data-testid="save-print-option"
                      >
                        <span className="material-symbols-outlined text-slate-500">print</span>
                        Save & Print
                      </button>
                      <button
                        onClick={() => { setShowSaveDropdown(false); parkBill(); }}
                        className="w-full px-4 py-2.5 text-left hover:bg-slate-50 flex items-center gap-3 text-sm border-t border-slate-100"
                        data-testid="park-bill-option"
                      >
                        <span className="material-symbols-outlined text-amber-500">pause_circle</span>
                        Park bill
                      </button>
                      <button
                        onClick={() => { setShowSaveDropdown(false); saveBillAndDeliver(); }}
                        className="w-full px-4 py-2.5 text-left hover:bg-slate-50 flex items-center gap-3 text-sm border-t border-slate-100"
                        data-testid="save-deliver-option"
                      >
                        <span className="material-symbols-outlined text-blue-500">local_shipping</span>
                        Save & Deliver
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </section>

        {/* Billing Table */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm flex-grow flex flex-col overflow-hidden">
          <div className="flex-grow overflow-auto" style={{ scrollbarWidth: 'thin' }}>
            <table className="w-full text-left border-collapse table-fixed min-w-[1000px]">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr>
                  <th className="w-12 px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">#</th>
                  <th className="w-[28%] px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Medicine</th>
                  <th className="w-24 px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Batch</th>
                  <th className="w-20 px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Expiry</th>
                  <th className="w-24 px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">MRP</th>
                  <th className="w-16 px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Qty</th>
                  <th className="w-24 px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Disc%/₹</th>
                  <th className="w-16 px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">GST</th>
                  <th className="w-28 px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Amount</th>
                  {viewMode !== 'view' && (
                    <th className="w-10 px-2 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">×</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {billItems.map((item, index) => {
                  // Calculate discount amount for display
                  const itemDiscountAmount = (item.qty * item.unit_price) * (item.discount_percent / 100);
                  // Check if expiry is within 3 months
                  const expiryDate = new Date(item.expiry_date);
                  const threeMonthsFromNow = new Date();
                  threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);
                  const isExpiryNear = expiryDate <= threeMonthsFromNow && expiryDate > new Date();
                  
                  return (
                  <tr key={item.id} className="group hover:bg-slate-50/50 transition-colors">
                    {/* # */}
                    <td className="px-4 py-2 text-xs font-medium text-slate-400">{String(index + 1).padStart(2, '0')}</td>
                    
                    {/* Medicine */}
                    <td className="px-4 py-2">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900">{item.product_name}</span>
                          {(item.schedule === 'H' || item.schedule === 'H1' || item.scheduleH) && (
                            <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded">
                              Rx
                            </span>
                          )}
                        </div>
                        {/* Always visible sub-line: batch no · LP ₹X · ▲margin% · salt content */}
                        <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-400">
                          <span className="font-mono">{item.batch_no}</span>
                          <span>·</span>
                          <span>LP ₹{(item.cost_price || item.unit_price * 0.7).toFixed(2)}</span>
                          <span>·</span>
                          <span className="text-green-600">▲{(((item.unit_price - (item.cost_price || item.unit_price * 0.7)) / (item.cost_price || item.unit_price * 0.7)) * 100).toFixed(0)}%</span>
                          {item.composition && (
                            <>
                              <span>·</span>
                              <span className="truncate max-w-[120px]">{item.composition}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                    
                    {/* Batch - Clickable */}
                    <td className="px-4 py-2 relative">
                      <button
                        onClick={() => openBatchPanel(index)}
                        className="text-xs font-mono hover:text-[#4682B4] hover:underline cursor-pointer"
                        data-testid={`batch-select-${index}`}
                      >
                        {item.batch_no}
                      </button>
                      
                      {/* Batch Selection Panel */}
                      {showBatchPanel === index && batchPanelData.length > 0 && (
                        <div 
                          ref={batchPanelRef}
                          className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 w-[480px] max-h-64 overflow-hidden"
                        >
                          <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-600">Select Batch</span>
                            <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={hidZeroStock}
                                onChange={(e) => setHidZeroStock(e.target.checked)}
                                className="rounded border-slate-300 text-[#4682B4] focus:ring-[#4682B4]"
                              />
                              Hide zero stock
                            </label>
                          </div>
                          <div className="grid grid-cols-7 gap-1 px-3 py-1.5 bg-slate-50 text-[10px] font-semibold text-slate-400 uppercase border-b border-slate-200">
                            <span>Batch</span>
                            <span>Expiry</span>
                            <span className="text-right">MRP</span>
                            <span className="text-right">Prev</span>
                            <span className="text-right">Disc%</span>
                            <span className="text-right">LP</span>
                            <span className="text-right">Stock</span>
                          </div>
                          <div className="max-h-40 overflow-y-auto">
                            {batchPanelData
                              .filter(batch => !hidZeroStock || (batch.qty_on_hand > 0))
                              .map((batch) => {
                                const batchExpiry = new Date(batch.expiry_date);
                                const isBatchExpiryNear = batchExpiry <= threeMonthsFromNow && batchExpiry > new Date();
                                const isSelected = batch.batch_no === item.batch_no;
                                
                                return (
                                  <div
                                    key={batch.id || batch.batch_no}
                                    onClick={() => selectBatch(index, batch)}
                                    className={`grid grid-cols-7 gap-1 px-3 py-2 text-xs cursor-pointer border-b border-slate-100 last:border-0 ${
                                      isSelected ? 'bg-[#4682B4]/10 text-[#4682B4]' : 'hover:bg-slate-50'
                                    }`}
                                  >
                                    <span className="font-mono font-medium">{batch.batch_no}</span>
                                    <span className={isBatchExpiryNear ? 'text-amber-600 font-semibold' : ''}>
                                      {formatExpiry(batch.expiry_date)}
                                    </span>
                                    <span className="text-right font-semibold">₹{(batch.mrp_per_unit || 0).toFixed(2)}</span>
                                    <span className="text-right text-slate-400">₹{(batch.prev_mrp || batch.mrp_per_unit || 0).toFixed(2)}</span>
                                    <span className="text-right">{(batch.discount_percent || 0).toFixed(1)}%</span>
                                    <span className="text-right">₹{(batch.cost_price_per_unit || batch.ptr_per_unit || 0).toFixed(2)}</span>
                                    <span className={`text-right font-semibold ${batch.qty_on_hand > 20 ? 'text-green-600' : batch.qty_on_hand > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                                      {batch.qty_on_hand > 0 ? batch.qty_on_hand : 'Out'}
                                    </span>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      )}
                    </td>
                    
                    {/* Expiry */}
                    <td className="px-4 py-2">
                      <span className={`text-xs ${isExpired(item.expiry_date) ? 'text-red-600 font-bold' : isExpiryNear ? 'text-amber-600 font-bold' : 'text-slate-600'}`}>
                        {formatExpiry(item.expiry_date)}
                      </span>
                    </td>
                    
                    {/* MRP */}
                    <td className="px-4 py-2 text-right">
                      {viewMode === 'view' ? (
                        <span className="text-sm text-right font-medium">₹{item.unit_price?.toFixed(2)}</span>
                      ) : (
                        <input
                          type="number"
                          step="0.01"
                          className="w-full bg-transparent border-transparent focus:border-primary p-0 text-sm text-right font-medium"
                          value={item.unit_price}
                          onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                          data-testid={`price-${index}`}
                        />
                      )}
                    </td>
                    
                    {/* Qty */}
                    <td className="px-4 py-2 text-right">
                      {viewMode === 'view' ? (
                        <span className="text-sm text-right font-medium">{item.qty}</span>
                      ) : (
                        <input
                          type="number"
                          className="w-full bg-transparent border-transparent focus:border-primary p-0 text-sm text-right font-medium"
                          value={item.qty}
                          min="1"
                          max={item.available_qty}
                          onChange={(e) => updateItem(index, 'qty', parseInt(e.target.value) || 1)}
                          data-testid={`qty-${index}`}
                        />
                      )}
                    </td>
                    
                    {/* Disc%/₹ */}
                    <td className="px-4 py-2 text-right">
                      <div className="flex flex-col items-end">
                        {viewMode === 'view' ? (
                          <span className={`text-sm text-right ${item.discount_percent > 0 ? 'text-rose-500' : ''}`}>{item.discount_percent?.toFixed(1)}%</span>
                        ) : (
                          <input
                            type="number"
                            step="0.1"
                            className={`w-full bg-transparent border-transparent focus:border-primary p-0 text-sm text-right ${item.discount_percent > 0 ? 'text-rose-500' : ''}`}
                            value={item.discount_percent}
                            onChange={(e) => updateItem(index, 'discount_percent', parseFloat(e.target.value) || 0)}
                            data-testid={`discount-${index}`}
                          />
                        )}
                        <span className={`text-[10px] ${itemDiscountAmount > 0 ? 'text-green-600 font-medium' : 'text-slate-400'}`}>
                          {itemDiscountAmount > 0 ? `-₹${itemDiscountAmount.toFixed(2)}` : '₹0.00'}
                        </span>
                      </div>
                    </td>
                    
                    {/* GST */}
                    <td className="px-4 py-2 text-right">
                      {viewMode === 'view' ? (
                        <span className="text-sm text-right">{item.gst_percent}%</span>
                      ) : (
                        <input
                          type="number"
                          step="0.1"
                          className="w-full bg-transparent border-transparent focus:border-primary p-0 text-sm text-right"
                          value={item.gst_percent}
                          onChange={(e) => updateItem(index, 'gst_percent', parseFloat(e.target.value) || 0)}
                          data-testid={`gst-${index}`}
                        />
                      )}
                    </td>
                    
                    {/* Amount */}
                    <td className="px-4 py-2 text-right text-sm font-bold text-slate-900">₹{item.net_amount?.toFixed(2)}</td>
                    
                    {/* Delete × - Only in edit/new mode */}
                    {viewMode !== 'view' && (
                      <td className="px-2 py-2 text-center">
                        <button
                          onClick={() => removeItem(index)}
                          className="text-slate-300 hover:text-red-500 transition-colors text-lg font-bold"
                          data-testid={`remove-${index}`}
                        >
                          ×
                        </button>
                      </td>
                    )}
                  </tr>
                  );
                })}
                {/* Empty row for adding new items - Only in edit/new mode */}
                {viewMode !== 'view' && (
                <tr className="bg-slate-50/30">
                  <td className="px-4 py-2 text-xs font-medium text-slate-300">{String(billItems.length + 1).padStart(2, '0')}</td>
                  <td className="px-4 py-2 relative" colSpan="2">
                    <input
                      ref={searchInputRef}
                      type="text"
                      className="w-full bg-transparent border-dashed border-b border-slate-200 focus:border-primary p-0 text-sm"
                      placeholder="Type medicine or batch..."
                      value={newItemSearch}
                      onChange={(e) => {
                        setNewItemSearch(e.target.value);
                        handleSearch(e.target.value);
                      }}
                      onFocus={() => newItemSearch.length >= 2 && setShowSearchResults(true)}
                      onBlur={() => setTimeout(() => setShowSearchResults(false), 200)}
                      data-testid="new-item-search"
                    />
                    {/* Search Results Dropdown */}
                    {showSearchResults && searchResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
                        {searchResults.map((product) => (
                          <div key={product.sku} className="border-b border-slate-100 last:border-0">
                            <div className="px-3 py-1.5 bg-slate-50">
                              <span className="font-semibold text-sm">{product.name}</span>
                              <span className="text-xs text-slate-500 ml-2">SKU: {product.sku}</span>
                            </div>
                            {product.batches?.map((batch) => (
                              <div
                                key={batch.batch_no}
                                className="px-3 py-2 hover:bg-slate-50 cursor-pointer flex items-center justify-between"
                                onClick={() => { addItemToBill(product, batch); setNewItemSearch(''); }}
                              >
                                <div className="flex items-center gap-3">
                                  <span className="text-xs font-mono text-slate-600">{batch.batch_no}</span>
                                  <span className={`text-xs ${isExpired(batch.expiry_date) ? 'text-red-600 font-bold' : isExpiringSoon(batch.expiry_date) ? 'text-amber-600 font-bold' : 'text-slate-500'}`}>
                                    Exp: {formatExpiry(batch.expiry_date)}
                                  </span>
                                  <span className="text-xs text-slate-500">Stock: {batch.qty_on_hand}</span>
                                </div>
                                <span className="font-semibold text-sm">₹{batch.mrp_per_unit?.toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td colSpan="6" className="px-4 py-2"></td>
                  {viewMode !== 'view' && <td className="px-2 py-2"></td>}
                </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Footer Section - Phase 3 Sticky Footer */}
        <section className="mt-auto border-t border-slate-200 bg-white">
          {/* Row 1: Numbers Strip */}
          <div className="bg-slate-50 px-4 py-3 flex items-center justify-between gap-4 text-sm border-b border-slate-200">
            <div className="flex items-center gap-6">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Items</span>
                <span className="font-bold text-slate-700">{billItems.length}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">MRP Total</span>
                <span className="font-bold text-slate-700">₹{mrpTotal.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Item Disc</span>
                <span className="font-bold text-rose-500">-₹{(totalDiscount - (billDiscountType === '%' ? subtotal * (billDiscount / 100) : billDiscount)).toFixed(2)}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Bill Disc</span>
                <span className="font-bold text-rose-500">-₹{billDiscountType === '%' ? (mrpTotal - (mrpTotal - totalDiscount) * (1 - billDiscount/100)).toFixed(2) : billDiscount.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">GST</span>
                <span className="font-bold text-slate-700">₹{totalGst.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">CESS</span>
                <span className="font-bold text-slate-700">₹{totalCess.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Margin</span>
                <span className="font-bold text-green-600">₹{margin.amount.toFixed(2)} ({margin.percent.toFixed(1)}%)</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Net Payable</span>
              <span className="text-2xl font-black text-slate-900">₹{grandTotal.toFixed(2)}</span>
            </div>
          </div>
          
          {/* Row 2: Actions Strip */}
          <div className="px-4 py-3 flex items-center justify-between gap-4">
            {/* Bill Discount Input - Only in edit/new mode */}
            {viewMode !== 'view' ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600 font-medium">Bill discount</span>
                <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setBillDiscountType('%')}
                    className={`px-2 py-1.5 text-xs font-bold ${billDiscountType === '%' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}
                  >
                    %
                  </button>
                  <button
                    onClick={() => setBillDiscountType('₹')}
                    className={`px-2 py-1.5 text-xs font-bold ${billDiscountType === '₹' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}
                  >
                    ₹
                  </button>
                </div>
                <input
                  type="number"
                  value={billDiscount}
                  onChange={(e) => setBillDiscount(parseFloat(e.target.value) || 0)}
                  className="w-20 px-2 py-1.5 border border-slate-200 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="0"
                  data-testid="bill-discount-input"
                />
              </div>
            ) : (
              <div className="flex items-center gap-4 text-sm">
                <div>
                  <span className="text-slate-500">Subtotal:</span>
                  <span className="ml-2 font-semibold">₹{mrpTotal.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-slate-500">Discount:</span>
                  <span className="ml-2 font-semibold text-rose-500">-₹{totalDiscount.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-slate-500">GST:</span>
                  <span className="ml-2 font-semibold">₹{totalGst.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-slate-500">Total:</span>
                  <span className="ml-2 font-bold text-lg">₹{grandTotal.toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrintCurrentBill}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-2"
                data-testid="footer-print-btn"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
              <button
                onClick={() => {
                  if (customerPhone) {
                    const msg = `Your bill from PharmaCare. Total: ₹${grandTotal.toFixed(2)}`;
                    window.open(`https://wa.me/91${customerPhone}?text=${encodeURIComponent(msg)}`, '_blank');
                  } else {
                    toast.error('Add customer phone number first');
                  }
                }}
                className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 flex items-center gap-2"
                data-testid="footer-whatsapp-btn"
              >
                <span className="material-symbols-outlined text-lg">share</span>
                WhatsApp
              </button>
              {/* Finalise button - Only in edit/new mode */}
              {viewMode !== 'view' && (
                <button
                  onClick={openFinaliseModal}
                  className="px-6 py-2 rounded-lg text-sm font-bold text-slate-900 flex items-center gap-2 hover:brightness-95"
                  style={{ backgroundColor: '#13ecda' }}
                  data-testid="footer-finalise-btn"
                >
                  <span className="material-symbols-outlined text-lg">check_circle</span>
                  Finalise Bill
                </button>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Phase 4: Finalise Modal - Invoice Breakdown */}
      {showFinaliseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowFinaliseModal(false)}></div>
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-lg">Finalise Bill</h3>
                <p className="text-sm text-slate-500">{customerName || 'Counter Sale'}</p>
              </div>
              <button onClick={() => setShowFinaliseModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <span className="material-symbols-outlined text-slate-500">close</span>
              </button>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-2 gap-8">
                {/* Left Column - Invoice Breakdown */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-4">Invoice Breakdown</h4>
                  
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-600">MRP Total</span>
                    <span className="text-sm font-semibold">₹{mrpTotal.toFixed(2)}</span>
                  </div>
                  
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-600">Item Discounts</span>
                    <span className="text-sm font-semibold text-rose-500">-₹{(totalDiscount - (billDiscountType === '%' ? mrpTotal * billDiscount / 100 : billDiscount)).toFixed(2)}</span>
                  </div>
                  
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-600">Bill Discount</span>
                    <span className="text-sm font-semibold text-rose-500">-₹{(billDiscountType === '%' ? mrpTotal * billDiscount / 100 : billDiscount).toFixed(2)}</span>
                  </div>
                  
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-600">GST</span>
                    <span className="text-sm font-semibold">+₹{totalGst.toFixed(2)}</span>
                  </div>
                  
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-600">CESS</span>
                    <span className="text-sm font-semibold">+₹{totalCess.toFixed(2)}</span>
                  </div>
                  
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-600">Round off</span>
                    <span className="text-sm font-semibold">₹0.00</span>
                  </div>
                  
                  {/* Net Payable - Highlighted */}
                  <div className="flex justify-between py-4 mt-4 bg-[#4682B4]/10 rounded-lg px-4 -mx-4">
                    <span className="text-base font-bold text-slate-900">Net Payable</span>
                    <span className="text-2xl font-black" style={{ color: '#0d9488' }}>₹{grandTotal.toFixed(2)}</span>
                  </div>
                  
                  {/* Margin Info */}
                  <div className="flex justify-between py-2 mt-2">
                    <span className="text-sm text-slate-400">Margin</span>
                    <span className="text-sm font-semibold text-green-600">₹{margin.amount.toFixed(2)}</span>
                  </div>
                  
                  <div className="flex justify-between py-2">
                    <span className="text-sm text-slate-400">Margin %</span>
                    <span className="text-sm font-semibold text-green-600">{margin.percent.toFixed(1)}%</span>
                  </div>
                </div>
                
                {/* Right Column - Notes */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Internal Note</label>
                    <textarea
                      value={internalNote}
                      onChange={(e) => setInternalNote(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                      rows="4"
                      placeholder="Internal notes (not visible to customer)"
                      data-testid="internal-note"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Delivery Note</label>
                    <textarea
                      value={deliveryNote}
                      onChange={(e) => setDeliveryNote(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                      rows="4"
                      placeholder="Delivery instructions (if applicable)"
                      data-testid="delivery-note"
                    />
                  </div>
                  
                  {/* Payment Method Confirmation */}
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <span className="text-xs text-slate-400 block mb-1">Payment Method</span>
                    <span className="font-semibold text-slate-700 capitalize">{paymentType || 'Not selected'}</span>
                  </div>
                  
                  {/* Confirm Button */}
                  <button
                    onClick={confirmAndSaveBill}
                    disabled={isSaving}
                    className="w-full py-3 rounded-lg text-sm font-bold text-slate-900 flex items-center justify-center gap-2 hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                    style={{ backgroundColor: '#13ecda' }}
                    data-testid="confirm-save-btn"
                  >
                    {isSaving ? (
                      <>
                        <span className="material-symbols-outlined animate-spin">progress_activity</span>
                        Saving...
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined">check_circle</span>
                        Confirm & Save Bill
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Item 1: Schedule H Warning Dialog */}
      {showScheduleHWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowScheduleHWarning(false)}></div>
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                  <span className="material-symbols-outlined text-amber-600 text-2xl">medication</span>
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900">Schedule H Medicines</h3>
                  <p className="text-sm text-slate-500">Prescription verification required</p>
                </div>
              </div>
              
              <p className="text-sm text-slate-600 mb-6">
                This bill contains <strong>Schedule H medicines</strong>. Confirm you have a valid prescription from the prescribing doctor before proceeding.
              </p>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowScheduleHWarning(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
                  data-testid="schedule-h-cancel"
                >
                  Cancel
                </button>
                <button
                  onClick={proceedAfterScheduleHWarning}
                  className="flex-1 px-4 py-2.5 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600"
                  data-testid="schedule-h-confirm"
                >
                  Confirm Prescription
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print Receipt - Hidden but rendered for printing */}
      <div ref={printRef} className="print-receipt hidden print:block">
        {savedBillData && (
          <div style={{ width: '80mm', padding: '10px', fontFamily: 'monospace', fontSize: '12px' }}>
            <div style={{ textAlign: 'center', marginBottom: '10px' }}>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>PharmaCare</h2>
              <p style={{ margin: '2px 0', fontSize: '10px' }}>Pharmacy Management System</p>
              <p style={{ margin: '2px 0', fontSize: '10px' }}>Tel: 1800-XXX-XXXX</p>
            </div>
            
            <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '5px 0', margin: '5px 0' }}>
              <p style={{ margin: '2px 0' }}><strong>Invoice:</strong> {savedBillData.bill_number}</p>
              <p style={{ margin: '2px 0' }}><strong>Date:</strong> {new Date().toLocaleString('en-GB')}</p>
              <p style={{ margin: '2px 0' }}><strong>Customer:</strong> {savedBillData.customer_name}</p>
              {savedBillData.customer_phone && <p style={{ margin: '2px 0' }}><strong>Phone:</strong> {savedBillData.customer_phone}</p>}
            </div>
            
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #000' }}>
                  <th style={{ textAlign: 'left', padding: '3px 0' }}>Item</th>
                  <th style={{ textAlign: 'center', padding: '3px 0' }}>Qty</th>
                  <th style={{ textAlign: 'right', padding: '3px 0' }}>Amt</th>
                </tr>
              </thead>
              <tbody>
                {savedBillData.items?.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ padding: '3px 0', fontSize: '10px' }}>{item.product_name}</td>
                    <td style={{ textAlign: 'center', padding: '3px 0' }}>{item.qty}</td>
                    <td style={{ textAlign: 'right', padding: '3px 0' }}>₹{item.net_amount?.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            <div style={{ borderTop: '1px dashed #000', marginTop: '10px', paddingTop: '5px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Subtotal:</span>
                <span>₹{savedBillData.subtotal?.toFixed(2)}</span>
              </div>
              {savedBillData.total_discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Discount:</span>
                  <span>-₹{savedBillData.total_discount?.toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>GST:</span>
                <span>₹{savedBillData.total_gst?.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px', marginTop: '5px', borderTop: '1px solid #000', paddingTop: '5px' }}>
                <span>TOTAL:</span>
                <span>₹{savedBillData.grand_total?.toFixed(2)}</span>
              </div>
            </div>
            
            <div style={{ textAlign: 'center', marginTop: '15px', fontSize: '10px' }}>
              <p style={{ margin: '2px 0' }}>Payment: {savedBillData.payment_method?.toUpperCase()}</p>
              <p style={{ margin: '5px 0' }}>Thank you for your purchase!</p>
              <p style={{ margin: '2px 0' }}>Get well soon!</p>
            </div>
          </div>
        )}
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-receipt, .print-receipt * {
            visibility: visible !important;
            display: block !important;
          }
          .print-receipt {
            position: absolute;
            left: 0;
            top: 0;
            width: 80mm;
          }
        }
      `}</style>

      {/* Patient Search Modal */}
      {showPatientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowPatientModal(false)}></div>
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <h3 className="font-semibold text-lg">Select Patient</h3>
              <button onClick={() => setShowPatientModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <span className="material-symbols-outlined text-slate-500">close</span>
              </button>
            </div>
            
            {/* Search Input */}
            <div className="p-4 border-b border-slate-200">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                <input
                  type="text"
                  placeholder="Search by name or phone..."
                  value={patientSearch}
                  onChange={(e) => searchPatients(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  autoFocus
                  data-testid="patient-search-input"
                />
              </div>
            </div>

            {/* Patient List */}
            <div className="flex-1 overflow-y-auto">
              {/* Counter Sale - Always First Option */}
              <button
                onClick={() => selectPatient('counter')}
                className="w-full px-4 py-3 text-left hover:bg-[#4682B4]/10 flex items-center gap-3 border-b border-slate-100"
                data-testid="counter-sale-option"
              >
                <div className="w-10 h-10 rounded-full bg-[#4682B4]/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[#4682B4]">storefront</span>
                </div>
                <div>
                  <div className="font-semibold text-slate-900">Counter Sale</div>
                  <div className="text-xs text-slate-400">Walk-in customer without registration</div>
                </div>
              </button>

              {/* Loading State */}
              {patientLoading && (
                <div className="px-4 py-6 text-center text-slate-400">
                  <span className="material-symbols-outlined animate-spin">progress_activity</span>
                  <p className="mt-2 text-sm">Searching patients...</p>
                </div>
              )}

              {/* Patient Results */}
              {!patientLoading && patientResults.map((patient) => (
                <button
                  key={patient.id}
                  onClick={() => selectPatient(patient)}
                  className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center gap-3 border-b border-slate-100"
                  data-testid={`patient-${patient.id}`}
                >
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                    <span className="material-symbols-outlined text-slate-400">person</span>
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-slate-900">{patient.name}</div>
                    <div className="text-xs text-slate-400">
                      {patient.phone || patient.mobile || 'No phone'} 
                      {patient.age && ` · ${patient.age} yrs`}
                      {patient.gender && ` · ${patient.gender}`}
                    </div>
                  </div>
                </button>
              ))}

              {/* No Results */}
              {!patientLoading && patientSearch && patientResults.length === 0 && (
                <div className="px-4 py-6 text-center text-slate-400">
                  <span className="material-symbols-outlined text-3xl mb-2">person_search</span>
                  <p className="text-sm">No patients found for "{patientSearch}"</p>
                  <p className="text-xs mt-1">Select "Counter Sale" for walk-in customers</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
