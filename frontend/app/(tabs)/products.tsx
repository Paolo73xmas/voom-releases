import React, { useEffect, useState, useCallback, useMemo, memo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, RefreshControl, ActivityIndicator, ScrollView, Modal,
} from 'react-native';
import { Image } from 'expo-image';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { useDebounce } from '../../hooks/useDebounce';

interface Category {
  id: string;
  name: string;
  description?: string;
  parent_id?: string | null;
  is_active: boolean;
  display_order?: number;
  childCount?: number;
  productCount?: number;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  short_description?: string;
  unit_price: number;
  unit_of_measure?: string;
  image_url?: string | null;
  is_active: boolean;
  category_id?: string;
  accisa?: number;
  iva_percentage?: number;
  stock_quantity?: number;
}

interface Stats {
  totalProducts: number;
  activeProducts: number;
  categories: number;
  suppliers: number;
}

type ViewLevel = 'categories' | 'subcategories' | 'products';

export default function ProductsScreen() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<Stats>({ totalProducts: 0, activeProducts: 0, categories: 0, suppliers: 0 });

  // Navigation state
  const [viewLevel, setViewLevel] = useState<ViewLevel>('categories');
  const [rootCategories, setRootCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedSubCategory, setSelectedSubCategory] = useState<Category | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [innerLoading, setInnerLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 250);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Load root categories and stats
  const loadData = useCallback(async () => {
    try {
      // Fetch ALL categories in ONE request
      const { data: allCats } = await supabase
        .from('product_categories')
        .select('id, name, description, parent_id, display_order, is_active')
        .eq('is_active', true)
        .order('display_order')
        .order('name');

      const cats = allCats || [];
      const roots = cats.filter(c => !c.parent_id);
      const children = cats.filter(c => c.parent_id);

      // Count children per root (no DB call needed!)
      const rootsWithCount = roots.map(r => ({
        ...r,
        childCount: children.filter(ch => ch.parent_id === r.id).length,
      }));

      setRootCategories(rootsWithCount);

      // Stats - single count calls
      const { count: activeCount } = await supabase
        .from('products').select('id', { count: 'exact', head: true })
        .eq('is_active', true);
      const { count: supplierCount } = await supabase
        .from('suppliers').select('id', { count: 'exact', head: true })
        .eq('is_active', true);

      setStats({
        totalProducts: activeCount || 0,
        activeProducts: activeCount || 0,
        categories: roots.length,
        suppliers: supplierCount || 0,
      });
    } catch (e) {
      console.error('[Products] Error loading data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, []);

  // Load sub-categories (children of a root category)
  const loadSubCategories = useCallback(async (parentId: string) => {
    setInnerLoading(true);
    try {
      // First just load the sub-categories
      const { data, error } = await supabase
        .from('product_categories')
        .select('id, name, description, parent_id, display_order, is_active')
        .eq('parent_id', parentId)
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('[Products] Sub-categories query error:', error);
        setSubCategories([]);
        return;
      }

      // Set sub-categories immediately (no product counts yet)
      const subs = (data || []).map(s => ({ ...s, productCount: 0 }));
      setSubCategories(subs);

      // Then count products one by one (sequentially to avoid ERR_ABORTED)
      const updated = [...subs];
      for (let i = 0; i < updated.length; i++) {
        try {
          const { count } = await supabase
            .from('products')
            .select('id', { count: 'exact', head: true })
            .eq('category_id', updated[i].id)
            .eq('is_active', true)
            .not('short_description', 'like', 'EST-%');
          updated[i] = { ...updated[i], productCount: count || 0 };
        } catch {}
      }
      setSubCategories([...updated]);
    } catch (e) {
      console.error('[Products] Error loading sub-categories:', e);
    } finally {
      setInnerLoading(false);
    }
  }, []);

  // Load products for a sub-category
  const loadProducts = useCallback(async (categoryId: string) => {
    setInnerLoading(true);
    try {
      const { data } = await supabase
        .from('products')
        .select('id, name, sku, short_description, unit_price, unit_of_measure, image_url, is_active, category_id, accisa, iva_percentage, stock_quantity')
        .eq('category_id', categoryId)
        .eq('is_active', true)
        .not('short_description', 'like', 'EST-%')
        .order('short_description');
      setProducts(data || []);
    } catch (e) {
      console.error('[Products] Error loading products:', e);
    } finally {
      setInnerLoading(false);
    }
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    if (viewLevel === 'products' && selectedSubCategory) {
      await loadProducts(selectedSubCategory.id);
    } else if (viewLevel === 'subcategories' && selectedCategory) {
      await loadSubCategories(selectedCategory.id);
    } else {
      await loadData();
    }
    setRefreshing(false);
  };

  // Navigation
  const handleSelectCategory = (cat: Category) => {
    setSelectedCategory(cat);
    setViewLevel('subcategories');
    setSearchQuery('');
    loadSubCategories(cat.id);
  };

  const handleSelectSubCategory = (sub: Category) => {
    setSelectedSubCategory(sub);
    setViewLevel('products');
    setSearchQuery('');
    loadProducts(sub.id);
  };

  const handleBack = () => {
    if (viewLevel === 'products') {
      setViewLevel('subcategories');
      setSelectedSubCategory(null);
      setProducts([]);
      setSearchQuery('');
    } else if (viewLevel === 'subcategories') {
      setViewLevel('categories');
      setSelectedCategory(null);
      setSubCategories([]);
      setSearchQuery('');
    }
  };

  const formatPrice = (price: number) => price.toFixed(2).replace('.', ',') + ' \u20AC';

  // ===== LEVEL 1: ROOT CATEGORIES =====
  const renderCategoryView = () => (
    <ScrollView
      style={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { borderLeftColor: '#3B82F6' }]}>
          <Ionicons name="cube-outline" size={20} color="#3B82F6" />
          <Text style={styles.statValue}>{stats.totalProducts}</Text>
          <Text style={styles.statLabel}>Totale Prodotti</Text>
        </View>
        <View style={[styles.statCard, { borderLeftColor: '#10B981' }]}>
          <Ionicons name="checkmark-circle-outline" size={20} color="#10B981" />
          <Text style={styles.statValue}>{stats.activeProducts}</Text>
          <Text style={styles.statLabel}>Attivi</Text>
        </View>
        <View style={[styles.statCard, { borderLeftColor: '#8B5CF6' }]}>
          <Ionicons name="layers-outline" size={20} color="#8B5CF6" />
          <Text style={styles.statValue}>{stats.categories}</Text>
          <Text style={styles.statLabel}>Categorie</Text>
        </View>
        <View style={[styles.statCard, { borderLeftColor: '#F59E0B' }]}>
          <Ionicons name="business-outline" size={20} color="#F59E0B" />
          <Text style={styles.statValue}>{stats.suppliers}</Text>
          <Text style={styles.statLabel}>Fornitori</Text>
        </View>
      </View>

      <Text style={styles.subtitle}>Seleziona una categoria per visualizzare i prodotti</Text>

      <View style={styles.grid}>
        {rootCategories.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={styles.gridCard}
            onPress={() => handleSelectCategory(cat)}
            activeOpacity={0.7}
          >
            <View style={[styles.gridIconWrap, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="folder-open-outline" size={22} color="#3B82F6" />
            </View>
            <Text style={styles.gridCardTitle} numberOfLines={1}>{cat.name}</Text>
            {cat.description ? (
              <Text style={styles.gridCardDesc} numberOfLines={2}>{cat.description}</Text>
            ) : null}
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );

  // ===== LEVEL 2: SUB-CATEGORIES =====
  const filteredSubs = useMemo(() => debouncedSearch.trim()
    ? subCategories.filter(s => s.name.toLowerCase().includes(debouncedSearch.toLowerCase()))
    : subCategories, [debouncedSearch, subCategories]);

  const renderSubCategoryView = () => (
    <View style={styles.innerContent}>
      <View style={styles.navHeader}>
        <TouchableOpacity onPress={handleBack} style={styles.backRow}>
          <Ionicons name="arrow-back" size={20} color="#1E40AF" />
          <Text style={styles.backText}>Categorie</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>{selectedCategory?.name}</Text>
        <Text style={styles.navCount}>{subCategories.length} sottocategorie disponibili</Text>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color="#6B7280" />
        <TextInput
          style={styles.searchInput}
          placeholder="Cerca sotto-categoria..."
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      {innerLoading ? (
        <ActivityIndicator size="large" color="#1E40AF" style={{ marginTop: 40 }} />
      ) : (
        <FlashList
          data={filteredSubs}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={{ paddingBottom: 20 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.subCatCard}
              onPress={() => handleSelectSubCategory(item)}
              activeOpacity={0.7}
            >
              <View style={[styles.gridIconWrap, { backgroundColor: '#F5F3FF' }]}>
                <Ionicons name="folder-outline" size={18} color="#8B5CF6" />
              </View>
              <Text style={styles.gridCardTitle} numberOfLines={2}>{item.name}</Text>
              {item.description ? (
                <Text style={styles.gridCardDesc} numberOfLines={1}>{item.description}</Text>
              ) : null}
              <Text style={styles.gridCardCount}>{item.productCount} prodotti</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="folder-open-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyText}>Nessuna sotto-categoria trovata</Text>
            </View>
          }
        />
      )}
    </View>
  );

  // ===== LEVEL 3: PRODUCTS =====
  const filteredProducts = useMemo(() => debouncedSearch.trim()
    ? products.filter(p =>
        (p.short_description || '').toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        p.sku.toLowerCase().includes(debouncedSearch.toLowerCase())
      )
    : products, [debouncedSearch, products]);

  const handleSelectProduct = useCallback((p: Product) => setSelectedProduct(p), []);

  const renderProductItem = useCallback(({ item }: { item: Product }) => (
    <TouchableOpacity style={styles.productCard} onPress={() => handleSelectProduct(item)} activeOpacity={0.7}>
      {item.image_url ? (
        <Image source={{ uri: item.image_url }} style={styles.productImage} contentFit="contain" cachePolicy="memory-disk" transition={150} />
      ) : (
        <View style={styles.productImagePlaceholder}>
          <Ionicons name="cube-outline" size={20} color="#9CA3AF" />
        </View>
      )}
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>
          {item.short_description || item.name}
        </Text>
        <Text style={styles.productSku}>{item.sku}</Text>
        {item.accisa ? (
          <Text style={styles.productAccisa}>Accisa: {formatPrice(item.accisa)}</Text>
        ) : null}
      </View>
      <View style={styles.productPriceWrap}>
        <Text style={styles.productPrice}>{formatPrice(item.unit_price)}</Text>
        {item.unit_of_measure ? (
          <Text style={styles.productUnit}>/{item.unit_of_measure}</Text>
        ) : null}
        {item.stock_quantity != null && item.stock_quantity > 0 ? (
          <View style={styles.stockBadge}>
            <Ionicons name="cube" size={10} color="#FFF" />
            <Text style={styles.stockText}>{item.stock_quantity}</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  ), [handleSelectProduct]);

  const renderProductDetailModal = () => {
    if (!selectedProduct) return null;
    const p = selectedProduct;
    return (
      <Modal visible={!!selectedProduct} animationType="slide" transparent onRequestClose={() => setSelectedProduct(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setSelectedProduct(null)}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={2}>{p.short_description || p.name}</Text>
              <TouchableOpacity onPress={() => setSelectedProduct(null)}>
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ paddingHorizontal: 16, paddingBottom: 20 }}>
              {/* Image */}
              {p.image_url ? (
                <Image source={{ uri: p.image_url }} style={styles.modalImage} contentFit="contain" cachePolicy="memory-disk" transition={200} />
              ) : (
                <View style={styles.modalImagePlaceholder}>
                  <Ionicons name="cube-outline" size={48} color="#D1D5DB" />
                  <Text style={{ color: '#9CA3AF', marginTop: 8 }}>Nessuna immagine</Text>
                </View>
              )}

              {/* Data rows */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Informazioni Prodotto</Text>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Nome completo</Text>
                  <Text style={styles.detailValue}>{p.name}</Text>
                </View>

                {p.short_description && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Descrizione breve</Text>
                    <Text style={styles.detailValue}>{p.short_description}</Text>
                  </View>
                )}

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>SKU</Text>
                  <Text style={[styles.detailValue, { fontFamily: 'monospace' }]}>{p.sku}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Stato</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: p.is_active ? '#10B981' : '#EF4444' }} />
                    <Text style={[styles.detailValue, { color: p.is_active ? '#10B981' : '#EF4444' }]}>{p.is_active ? 'Attivo' : 'Non attivo'}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Prezzi e Tasse</Text>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Prezzo unitario</Text>
                  <Text style={[styles.detailValue, { fontSize: 18, fontWeight: '800', color: '#1E40AF' }]}>{formatPrice(p.unit_price)}</Text>
                </View>

                {p.accisa != null && p.accisa > 0 && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Accisa</Text>
                    <Text style={styles.detailValue}>{formatPrice(p.accisa)}</Text>
                  </View>
                )}

                {p.iva_percentage != null && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>IVA</Text>
                    <Text style={styles.detailValue}>{p.iva_percentage}%</Text>
                  </View>
                )}

                {p.unit_of_measure && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Unità di misura</Text>
                    <Text style={styles.detailValue}>{p.unit_of_measure}</Text>
                  </View>
                )}
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Magazzino</Text>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Quantità in stock</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[styles.detailValue, { fontWeight: '700', color: (p.stock_quantity || 0) > 0 ? '#059669' : '#DC2626' }]}>
                      {p.stock_quantity ?? 0}
                    </Text>
                    {(p.stock_quantity || 0) <= 0 && (
                      <Text style={{ fontSize: 11, color: '#DC2626', fontWeight: '600' }}>Esaurito</Text>
                    )}
                  </View>
                </View>
              </View>

              <View style={{ height: 30 }} />
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  const renderProductView = () => (
    <View style={styles.innerContent}>
      <View style={styles.navHeader}>
        <TouchableOpacity onPress={handleBack} style={styles.backRow}>
          <Ionicons name="arrow-back" size={20} color="#1E40AF" />
          <Text style={styles.backText}>{selectedCategory?.name}</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>{selectedSubCategory?.name}</Text>
        <Text style={styles.navCount}>{filteredProducts.length} prodotti disponibili</Text>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color="#6B7280" />
        <TextInput
          style={styles.searchInput}
          placeholder="Cerca prodotto o SKU..."
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      {innerLoading ? (
        <ActivityIndicator size="large" color="#1E40AF" style={{ marginTop: 40 }} />
      ) : (
        <FlashList
          data={filteredProducts}
          renderItem={renderProductItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 20 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="cube-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyText}>Nessun prodotto trovato</Text>
            </View>
          }
        />
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E40AF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {viewLevel === 'categories' && renderCategoryView()}
      {viewLevel === 'subcategories' && renderSubCategoryView()}
      {viewLevel === 'products' && renderProductView()}
      {renderProductDetailModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { flex: 1, paddingHorizontal: 16 },
  innerContent: { flex: 1, paddingHorizontal: 16 },

  // Stats
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  statCard: {
    width: '47%', backgroundColor: '#FFF', borderRadius: 12, padding: 14, borderLeftWidth: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  statValue: { fontSize: 26, fontWeight: '700', color: '#1F2937', marginTop: 6 },
  statLabel: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  subtitle: { fontSize: 14, color: '#6B7280', marginTop: 20, marginBottom: 12 },

  // Grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: 24 },
  gridRow: { gap: 10, marginBottom: 4 },
  gridCard: {
    width: '47%', backgroundColor: '#FFF', borderRadius: 12, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  gridIconWrap: {
    width: 34, height: 34, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  gridCardTitle: { fontSize: 13, fontWeight: '600', color: '#1F2937' },
  gridCardDesc: { fontSize: 10, color: '#6B7280', marginTop: 2 },
  gridCardCount: { fontSize: 11, color: '#3B82F6', fontWeight: '500', marginTop: 4 },

  // Sub-category card
  subCatCard: {
    width: '48%', backgroundColor: '#FFF', borderRadius: 10, padding: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },

  // Nav header
  navHeader: { marginTop: 12, marginBottom: 10 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  backText: { fontSize: 14, color: '#1E40AF', fontWeight: '500' },
  navTitle: { fontSize: 22, fontWeight: '700', color: '#1F2937' },
  navCount: { fontSize: 13, color: '#6B7280', marginTop: 2 },

  // Search
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF',
    borderRadius: 10, paddingHorizontal: 12, height: 44, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15, color: '#1F2937' },

  // Product card
  productCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF',
    borderRadius: 10, padding: 8, paddingHorizontal: 10, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  productImage: { width: 42, height: 42, borderRadius: 6, backgroundColor: '#F9FAFB' },
  productImagePlaceholder: {
    width: 42, height: 42, borderRadius: 6, backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center',
  },
  productInfo: { flex: 1, marginLeft: 10 },
  productName: { fontSize: 13, fontWeight: '600', color: '#1F2937', lineHeight: 17 },
  productSku: { fontSize: 10, color: '#9CA3AF', marginTop: 1 },
  productAccisa: { fontSize: 10, color: '#6B7280', marginTop: 1 },
  productPriceWrap: { alignItems: 'flex-end', marginLeft: 6 },
  productPrice: { fontSize: 14, fontWeight: '700', color: '#1E40AF' },
  productUnit: { fontSize: 10, color: '#9CA3AF' },
  stockBadge: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#10B981',
    borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1, marginTop: 3, gap: 2,
  },
  stockText: { fontSize: 9, color: '#FFF', fontWeight: '600' },

  // Empty
  emptyWrap: { alignItems: 'center', marginTop: 60 },
  emptyText: { fontSize: 14, color: '#9CA3AF', marginTop: 12 },

  // Product Detail Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', flex: 1, marginRight: 12 },
  modalImage: { width: '100%', height: 220, borderRadius: 12, marginTop: 12, backgroundColor: '#F9FAFB' },
  modalImagePlaceholder: { width: '100%', height: 160, borderRadius: 12, marginTop: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  detailSection: { marginTop: 16, backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14 },
  detailSectionTitle: { fontSize: 13, fontWeight: '700', color: '#6B7280', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  detailLabel: { fontSize: 13, color: '#6B7280', flex: 1 },
  detailValue: { fontSize: 14, fontWeight: '600', color: '#1F2937', textAlign: 'right', flex: 1 },
});
