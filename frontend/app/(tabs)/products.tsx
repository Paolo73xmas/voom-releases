import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, RefreshControl, ActivityIndicator, Image, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';

interface ProductCategory {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  product_count?: number;
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
  supplier_id?: string;
  accisa?: number;
  iva_percentage?: number;
}

interface SubCategory {
  name: string;
  count: number;
  image_url?: string | null;
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
  const [categories, setCategories] = useState<ProductCategory[]>([]);

  // Navigation state
  const [viewLevel, setViewLevel] = useState<ViewLevel>('categories');
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | null>(null);
  const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(null);

  // Data
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [innerLoading, setInnerLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = useCallback(async () => {
    try {
      const { data: cats } = await supabase
        .from('product_categories')
        .select('id, name, description, is_active')
        .eq('is_active', true)
        .order('name');

      const activeCats = cats || [];

      const catsWithCount = await Promise.all(
        activeCats.map(async (cat) => {
          const { count } = await supabase
            .from('products')
            .select('id', { count: 'exact', head: true })
            .eq('category_id', cat.id)
            .eq('is_active', true);
          return { ...cat, product_count: count || 0 };
        })
      );

      setCategories(catsWithCount);

      const { count: totalCount } = await supabase
        .from('products').select('id', { count: 'exact', head: true });
      const { count: activeCount } = await supabase
        .from('products').select('id', { count: 'exact', head: true }).eq('is_active', true);
      const { count: supplierCount } = await supabase
        .from('suppliers').select('id', { count: 'exact', head: true }).eq('is_active', true);

      setStats({
        totalProducts: totalCount || 0,
        activeProducts: activeCount || 0,
        categories: activeCats.length,
        suppliers: supplierCount || 0,
      });
    } catch (e) {
      console.error('[Products] Error loading data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, []);

  // Load sub-categories (unique product names) for a category
  const loadSubCategories = useCallback(async (categoryId: string) => {
    setInnerLoading(true);
    try {
      const { data } = await supabase
        .from('products')
        .select('name, image_url')
        .eq('category_id', categoryId)
        .eq('is_active', true)
        .order('name');

      if (data) {
        const grouped: Record<string, { count: number; image_url?: string | null }> = {};
        data.forEach((p) => {
          if (!grouped[p.name]) {
            grouped[p.name] = { count: 0, image_url: p.image_url };
          }
          grouped[p.name].count++;
        });
        const subs: SubCategory[] = Object.entries(grouped)
          .map(([name, info]) => ({ name, count: info.count, image_url: info.image_url }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setSubCategories(subs);
      }
    } catch (e) {
      console.error('[Products] Error loading sub-categories:', e);
    } finally {
      setInnerLoading(false);
    }
  }, []);

  // Load products for a specific name within a category
  const loadProducts = useCallback(async (categoryId: string, productName: string) => {
    setInnerLoading(true);
    try {
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('category_id', categoryId)
        .eq('name', productName)
        .eq('is_active', true)
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
    if (viewLevel === 'products' && selectedCategory && selectedSubCategory) {
      await loadProducts(selectedCategory.id, selectedSubCategory);
    } else if (viewLevel === 'subcategories' && selectedCategory) {
      await loadSubCategories(selectedCategory.id);
    } else {
      await loadData();
    }
    setRefreshing(false);
  };

  // Navigation handlers
  const handleSelectCategory = (cat: ProductCategory) => {
    setSelectedCategory(cat);
    setViewLevel('subcategories');
    setSearchQuery('');
    loadSubCategories(cat.id);
  };

  const handleSelectSubCategory = (name: string) => {
    if (!selectedCategory) return;
    setSelectedSubCategory(name);
    setViewLevel('products');
    setSearchQuery('');
    loadProducts(selectedCategory.id, name);
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

  // ===== LEVEL 1: CATEGORIES =====
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
        {categories.map((cat) => (
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
            <Text style={styles.gridCardCount}>{cat.product_count} prodotti</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );

  // ===== LEVEL 2: SUB-CATEGORIES (Product Names) =====
  const filteredSubCategories = searchQuery.trim()
    ? subCategories.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : subCategories;

  const renderSubCategoryView = () => (
    <View style={styles.innerContent}>
      <View style={styles.navHeader}>
        <TouchableOpacity onPress={handleBack} style={styles.backRow}>
          <Ionicons name="arrow-back" size={20} color="#1E40AF" />
          <Text style={styles.backText}>Categorie</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>{selectedCategory?.name}</Text>
        <Text style={styles.navCount}>{subCategories.length} sotto-categorie</Text>
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
        <FlatList
          data={filteredSubCategories}
          keyExtractor={(item) => item.name}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={{ paddingBottom: 20 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.subCatCard}
              onPress={() => handleSelectSubCategory(item.name)}
              activeOpacity={0.7}
            >
              {item.image_url ? (
                <Image source={{ uri: item.image_url }} style={styles.subCatImage} resizeMode="contain" />
              ) : (
                <View style={[styles.gridIconWrap, { backgroundColor: '#F0FDF4' }]}>
                  <Ionicons name="pricetag-outline" size={22} color="#10B981" />
                </View>
              )}
              <Text style={styles.gridCardTitle} numberOfLines={2}>{item.name}</Text>
              <Text style={styles.gridCardCount}>{item.count} prodotti</Text>
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

  // ===== LEVEL 3: PRODUCTS (by short_description) =====
  const filteredProducts = searchQuery.trim()
    ? products.filter(p =>
        (p.short_description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : products;

  const renderProductItem = ({ item }: { item: Product }) => (
    <View style={styles.productCard}>
      {item.image_url ? (
        <Image source={{ uri: item.image_url }} style={styles.productImage} resizeMode="contain" />
      ) : (
        <View style={styles.productImagePlaceholder}>
          <Ionicons name="cube-outline" size={28} color="#9CA3AF" />
        </View>
      )}
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>
          {item.short_description || item.name}
        </Text>
        <Text style={styles.productSku}>SKU: {item.sku}</Text>
      </View>
      <View style={styles.productPriceWrap}>
        <Text style={styles.productPrice}>{formatPrice(item.unit_price)}</Text>
        {item.unit_of_measure ? (
          <Text style={styles.productUnit}>/ {item.unit_of_measure}</Text>
        ) : null}
      </View>
    </View>
  );

  const renderProductView = () => (
    <View style={styles.innerContent}>
      <View style={styles.navHeader}>
        <TouchableOpacity onPress={handleBack} style={styles.backRow}>
          <Ionicons name="arrow-back" size={20} color="#1E40AF" />
          <Text style={styles.backText}>{selectedCategory?.name}</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>{selectedSubCategory}</Text>
        <Text style={styles.navCount}>{filteredProducts.length} prodotti</Text>
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
        <FlatList
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

  // Grid (categories & sub-categories)
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: 24 },
  gridRow: { gap: 10 },
  gridCard: {
    width: '47%', backgroundColor: '#FFF', borderRadius: 12, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  gridIconWrap: {
    width: 40, height: 40, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  gridCardTitle: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  gridCardDesc: { fontSize: 11, color: '#6B7280', marginTop: 3 },
  gridCardCount: { fontSize: 12, color: '#3B82F6', fontWeight: '500', marginTop: 6 },

  // Sub-category card
  subCatCard: {
    width: '48%', backgroundColor: '#FFF', borderRadius: 12, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  subCatImage: { width: 40, height: 40, borderRadius: 8, marginBottom: 10, backgroundColor: '#F9FAFB' },

  // Navigation header
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
    borderRadius: 12, padding: 12, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  productImage: { width: 52, height: 52, borderRadius: 8, backgroundColor: '#F9FAFB' },
  productImagePlaceholder: {
    width: 52, height: 52, borderRadius: 8, backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center',
  },
  productInfo: { flex: 1, marginLeft: 12 },
  productName: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  productSku: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  productPriceWrap: { alignItems: 'flex-end', marginLeft: 8 },
  productPrice: { fontSize: 15, fontWeight: '700', color: '#1E40AF' },
  productUnit: { fontSize: 11, color: '#9CA3AF' },

  // Empty
  emptyWrap: { alignItems: 'center', marginTop: 60 },
  emptyText: { fontSize: 14, color: '#9CA3AF', marginTop: 12 },
});
