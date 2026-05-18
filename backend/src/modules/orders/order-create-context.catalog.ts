import { listProductsForOrderCreateForm } from "../products/products.service";
import { listProductCategoriesForTenant } from "../reference/reference.service";
import {
  resolveConstraintScope,
  type LinkageConstraintScope,
  type LinkageSelectedMasters
} from "../linkage/linkage.service";

/** `create-context` va `create-catalog` uchun bir xil mahsulot + kategoriya kesimi (DRY). */
export async function loadOrderCreateCatalogSlice(
  tenantId: number,
  scope: LinkageConstraintScope
): Promise<{
  products: Awaited<ReturnType<typeof listProductsForOrderCreateForm>>;
  product_categories: Awaited<ReturnType<typeof listProductCategoriesForTenant>>;
}> {
  const useAgentOrScopedProductFetch =
    scope.constrained && (scope.product_ids.length > 0 || scope.product_restricted);
  const productsPromise = useAgentOrScopedProductFetch
    ? scope.product_ids.length > 0
      ? listProductsForOrderCreateForm(tenantId, { product_ids: scope.product_ids })
      : Promise.resolve([] as Awaited<ReturnType<typeof listProductsForOrderCreateForm>>)
    : listProductsForOrderCreateForm(tenantId);

  const [products, categories] = await Promise.all([productsPromise, listProductCategoriesForTenant(tenantId)]);

  const scopedProductIds = new Set(scope.product_ids);
  const constrainedProducts = scope.constrained
    ? scope.product_ids.length > 0
      ? products.filter((p) => scopedProductIds.has(p.id))
      : scope.product_restricted
        ? []
        : products
    : products;

  const productCategoriesFiltered =
    scope.selected_agent_id != null
      ? categories.filter((c) => constrainedProducts.some((p) => p.category_id === c.id))
      : categories;

  return {
    products: constrainedProducts,
    product_categories: productCategoriesFiltered
  };
}

export type OrderCreateCatalogBundle = {
  products: Awaited<ReturnType<typeof listProductsForOrderCreateForm>>;
  product_categories: Awaited<ReturnType<typeof listProductCategoriesForTenant>>;
};

/**
 * Zakaz formasi uchun faqat mahsulot + kategoriya (kichik javob).
 * `create-context` bilan bir xil kaskad mantiq — alohida chaqirib UI noto‘g‘ri katalog "flash" qilmasin.
 */
export async function getOrderCreateCatalogBundle(
  tenantId: number,
  selected: LinkageSelectedMasters = {}
): Promise<OrderCreateCatalogBundle> {
  const scope = await resolveConstraintScope(tenantId, selected);
  return loadOrderCreateCatalogSlice(tenantId, scope);
}
