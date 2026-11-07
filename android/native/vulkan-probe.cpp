// Independent Vulkan diagnostic helper. Never links llama.cpp or reads a GGUF.
// The Android caller runs this in a disposable process with a 6 second watchdog.
#define VK_NO_PROTOTYPES
#include <vulkan/vulkan.h>
#include <nlohmann/json.hpp>
#include <dlfcn.h>
#include <chrono>
#include <cstring>
#include <iostream>
#include <stdexcept>
#include <vector>
#include <algorithm>
#include "vector-add.spv.h"
using json=nlohmann::ordered_json;
struct Failure:std::runtime_error { std::string stage; int result; Failure(std::string s,int r):std::runtime_error("vulkan-call-failed"),stage(std::move(s)),result(r){} };
static void ok(VkResult r,const char* stage){if(r!=VK_SUCCESS)throw Failure(stage,r);}
static std::string version(uint32_t n){return std::to_string(VK_VERSION_MAJOR(n))+"."+std::to_string(VK_VERSION_MINOR(n))+"."+std::to_string(VK_VERSION_PATCH(n));}
static double elapsed(std::chrono::steady_clock::time_point t){return std::chrono::duration<double,std::milli>(std::chrono::steady_clock::now()-t).count();}
struct Probe {
 void* library=nullptr; VkInstance instance=VK_NULL_HANDLE; PFN_vkGetInstanceProcAddr get=nullptr;
 bool properties2Enabled=false;
 uint32_t loaderVersion=VK_API_VERSION_1_0, instanceVersion=VK_API_VERSION_1_0;
 ~Probe(){if(instance){auto f=reinterpret_cast<PFN_vkDestroyInstance>(get(instance,"vkDestroyInstance"));if(f)f(instance,nullptr);}if(library)dlclose(library);}
 template<class T>T fn(const char* name){auto p=reinterpret_cast<T>(get(instance,name));if(!p)throw Failure(std::string("entry-point:")+name,VK_ERROR_EXTENSION_NOT_PRESENT);return p;}
 void open(json& out){
  library=dlopen(
#ifdef __ANDROID__
   "libvulkan.so",
#else
   "libvulkan.so.1",
#endif
   RTLD_NOW|RTLD_LOCAL);
  out["loader"]={{"available",library!=nullptr}};
  if(!library)throw Failure("loader",VK_ERROR_INITIALIZATION_FAILED);
  get=reinterpret_cast<PFN_vkGetInstanceProcAddr>(dlsym(library,"vkGetInstanceProcAddr"));if(!get)throw Failure("loader-entry-point",VK_ERROR_INITIALIZATION_FAILED);
  auto enumerateVersion=reinterpret_cast<PFN_vkEnumerateInstanceVersion>(get(VK_NULL_HANDLE,"vkEnumerateInstanceVersion"));
  if(enumerateVersion)ok(enumerateVersion(&loaderVersion),"loader-version");
  out["loader"]["versionKind"]="instance-api-not-loader-build";out["loader"]["libraryBuildVersion"]=nullptr;out["loader"]["apiVersion"]=version(loaderVersion);out["loader"]["apiVersionRaw"]=loaderVersion;
  instanceVersion=std::min(loaderVersion,VK_API_VERSION_1_3);properties2Enabled=instanceVersion>=VK_API_VERSION_1_1;
  VkApplicationInfo app{VK_STRUCTURE_TYPE_APPLICATION_INFO};app.pApplicationName="Calendar Vulkan diagnostics";app.apiVersion=instanceVersion;
  VkInstanceCreateInfo ci{VK_STRUCTURE_TYPE_INSTANCE_CREATE_INFO};ci.pApplicationInfo=&app;
  const char* extension=VK_KHR_GET_PHYSICAL_DEVICE_PROPERTIES_2_EXTENSION_NAME;
  if(instanceVersion<VK_API_VERSION_1_1){
   uint32_t n=0;auto f=fn<PFN_vkEnumerateInstanceExtensionProperties>("vkEnumerateInstanceExtensionProperties");ok(f(nullptr,&n,nullptr),"instance-extensions-count");if(n>1024)throw Failure("instance-extensions-limit",VK_ERROR_TOO_MANY_OBJECTS);
   std::vector<VkExtensionProperties> ext(n);ok(f(nullptr,&n,ext.data()),"instance-extensions");
   if(std::any_of(ext.begin(),ext.end(),[&](auto& e){return !strcmp(e.extensionName,extension);})){ci.enabledExtensionCount=1;ci.ppEnabledExtensionNames=&extension;properties2Enabled=true;}
  }
  ok(fn<PFN_vkCreateInstance>("vkCreateInstance")(&ci,nullptr,&instance),"instance-create");
 }
 std::vector<VkPhysicalDevice> devices(){uint32_t n=0;auto f=fn<PFN_vkEnumeratePhysicalDevices>("vkEnumeratePhysicalDevices");ok(f(instance,&n,nullptr),"devices-count");if(n>16)throw Failure("devices-limit",VK_ERROR_TOO_MANY_OBJECTS);std::vector<VkPhysicalDevice>d(n);if(n){ok(f(instance,&n,d.data()),"devices-enumerate");d.resize(n);}return d;}
 std::vector<VkQueueFamilyProperties> queues(VkPhysicalDevice d){uint32_t n=0;auto f=fn<PFN_vkGetPhysicalDeviceQueueFamilyProperties>("vkGetPhysicalDeviceQueueFamilyProperties");f(d,&n,nullptr);if(n>64)throw Failure("queue-family-limit",VK_ERROR_TOO_MANY_OBJECTS);std::vector<VkQueueFamilyProperties> q(n);f(d,&n,q.data());q.resize(n);return q;}
 json describe(VkPhysicalDevice d){
  VkPhysicalDeviceProperties p{};fn<PFN_vkGetPhysicalDeviceProperties>("vkGetPhysicalDeviceProperties")(d,&p);
  const char* types[]={"other","integrated","discrete","virtual","cpu"};
  json r={{"deviceName",p.deviceName},{"vendorID",p.vendorID},{"deviceID",p.deviceID},{"deviceType",p.deviceType<=4?types[p.deviceType]:"unknown"},{"softwareDevice",p.deviceType==VK_PHYSICAL_DEVICE_TYPE_CPU},{"apiVersion",version(p.apiVersion)},{"apiVersionRaw",p.apiVersion},{"driverVersionRaw",p.driverVersion}};
  r["limits"]={{"maxComputeSharedMemorySize",p.limits.maxComputeSharedMemorySize},{"maxComputeWorkGroupCount",{p.limits.maxComputeWorkGroupCount[0],p.limits.maxComputeWorkGroupCount[1],p.limits.maxComputeWorkGroupCount[2]}},{"maxComputeWorkGroupInvocations",p.limits.maxComputeWorkGroupInvocations},{"maxStorageBufferRange",p.limits.maxStorageBufferRange},{"maxMemoryAllocationCount",p.limits.maxMemoryAllocationCount},{"maxComputeWorkGroupSize",{p.limits.maxComputeWorkGroupSize[0],p.limits.maxComputeWorkGroupSize[1],p.limits.maxComputeWorkGroupSize[2]}}};
  r["queueFamilies"]=json::array();r["computeQueueAvailable"]=false;
  auto q=queues(d);for(size_t i=0;i<q.size();i++){bool compute=q[i].queueCount&&(q[i].queueFlags&VK_QUEUE_COMPUTE_BIT);r["queueFamilies"].push_back({{"index",i},{"queueCount",q[i].queueCount},{"flags",q[i].queueFlags},{"compute",compute}});if(compute)r["computeQueueAvailable"]=true;}
  uint32_t n=0;auto extensions=fn<PFN_vkEnumerateDeviceExtensionProperties>("vkEnumerateDeviceExtensionProperties");ok(extensions(d,nullptr,&n,nullptr),"device-extensions-count");if(n>2048)throw Failure("device-extensions-limit",VK_ERROR_TOO_MANY_OBJECTS);
  std::vector<VkExtensionProperties> e(n);if(n)ok(extensions(d,nullptr,&n,e.data()),"device-extensions");
  auto has=[&](const char* name){return std::any_of(e.begin(),e.end(),[&](auto& v){return !strcmp(v.extensionName,name);});};
  r["relevantExtensions"]=json::object();for(auto name:{"VK_KHR_16bit_storage","VK_KHR_8bit_storage","VK_KHR_shader_float16_int8","VK_KHR_shader_integer_dot_product","VK_KHR_cooperative_matrix","VK_NV_cooperative_matrix","VK_EXT_subgroup_size_control","VK_EXT_memory_budget","VK_KHR_driver_properties","VK_KHR_maintenance4"})r["relevantExtensions"][name]=has(name);
  VkPhysicalDeviceFeatures features{};fn<PFN_vkGetPhysicalDeviceFeatures>("vkGetPhysicalDeviceFeatures")(d,&features);
  r["features"]={{"shaderInt16",features.shaderInt16!=0},{"shaderInt64",features.shaderInt64!=0},{"shaderFloat64",features.shaderFloat64!=0},{"shaderStorageImageExtendedFormats",features.shaderStorageImageExtendedFormats!=0}};
  auto props2=reinterpret_cast<PFN_vkGetPhysicalDeviceProperties2>(get(instance,"vkGetPhysicalDeviceProperties2"));if(!props2)props2=reinterpret_cast<PFN_vkGetPhysicalDeviceProperties2>(get(instance,"vkGetPhysicalDeviceProperties2KHR"));
  if(props2&&properties2Enabled){
   VkPhysicalDeviceProperties2 p2{VK_STRUCTURE_TYPE_PHYSICAL_DEVICE_PROPERTIES_2};
   VkPhysicalDeviceDriverProperties driver{VK_STRUCTURE_TYPE_PHYSICAL_DEVICE_DRIVER_PROPERTIES};
   VkPhysicalDeviceSubgroupProperties subgroup{VK_STRUCTURE_TYPE_PHYSICAL_DEVICE_SUBGROUP_PROPERTIES};
   if(p.apiVersion>=VK_API_VERSION_1_2||has(VK_KHR_DRIVER_PROPERTIES_EXTENSION_NAME)){driver.pNext=p2.pNext;p2.pNext=&driver;}
   if(p.apiVersion>=VK_API_VERSION_1_1){subgroup.pNext=p2.pNext;p2.pNext=&subgroup;}
   props2(d,&p2);
   if(driver.driverName[0])r["driverProperties"]={{"driverID",driver.driverID},{"driverName",driver.driverName},{"driverInfo",driver.driverInfo},{"conformanceVersion",{driver.conformanceVersion.major,driver.conformanceVersion.minor,driver.conformanceVersion.subminor,driver.conformanceVersion.patch}}};
   if(subgroup.subgroupSize)r["subgroup"]={{"size",subgroup.subgroupSize},{"supportedStages",subgroup.supportedStages},{"supportedOperations",subgroup.supportedOperations},{"compute",(subgroup.supportedStages&VK_SHADER_STAGE_COMPUTE_BIT)!=0}};
  }
  auto features2=reinterpret_cast<PFN_vkGetPhysicalDeviceFeatures2>(get(instance,"vkGetPhysicalDeviceFeatures2"));if(!features2)features2=reinterpret_cast<PFN_vkGetPhysicalDeviceFeatures2>(get(instance,"vkGetPhysicalDeviceFeatures2KHR"));
  if(features2&&properties2Enabled){
   VkPhysicalDeviceFeatures2 f2{VK_STRUCTURE_TYPE_PHYSICAL_DEVICE_FEATURES_2};
   VkPhysicalDevice16BitStorageFeatures f16{VK_STRUCTURE_TYPE_PHYSICAL_DEVICE_16BIT_STORAGE_FEATURES};VkPhysicalDevice8BitStorageFeatures f8{VK_STRUCTURE_TYPE_PHYSICAL_DEVICE_8BIT_STORAGE_FEATURES};VkPhysicalDeviceShaderFloat16Int8Features fp16{VK_STRUCTURE_TYPE_PHYSICAL_DEVICE_SHADER_FLOAT16_INT8_FEATURES};
   if(p.apiVersion>=VK_API_VERSION_1_1||has(VK_KHR_16BIT_STORAGE_EXTENSION_NAME)){f16.pNext=f2.pNext;f2.pNext=&f16;}
   if(p.apiVersion>=VK_API_VERSION_1_2||has(VK_KHR_8BIT_STORAGE_EXTENSION_NAME)){f8.pNext=f2.pNext;f2.pNext=&f8;}
   if(p.apiVersion>=VK_API_VERSION_1_2||has(VK_KHR_SHADER_FLOAT16_INT8_EXTENSION_NAME)){fp16.pNext=f2.pNext;f2.pNext=&fp16;}
   features2(d,&f2);r["features"]["storageBuffer16BitAccess"]=f16.storageBuffer16BitAccess!=0;r["features"]["storageBuffer8BitAccess"]=f8.storageBuffer8BitAccess!=0;r["features"]["shaderFloat16"]=fp16.shaderFloat16!=0;r["features"]["shaderInt8"]=fp16.shaderInt8!=0;
  }
  VkPhysicalDeviceMemoryProperties memory{};fn<PFN_vkGetPhysicalDeviceMemoryProperties>("vkGetPhysicalDeviceMemoryProperties")(d,&memory);
  r["memory"]={{"interpretation","Vulkan heaps/budgets; not confirmed dedicated VRAM"},{"heaps",json::array()},{"types",json::array()}};
  for(uint32_t i=0;i<memory.memoryHeapCount;i++)r["memory"]["heaps"].push_back({{"index",i},{"sizeBytes",memory.memoryHeaps[i].size},{"deviceLocal",(memory.memoryHeaps[i].flags&VK_MEMORY_HEAP_DEVICE_LOCAL_BIT)!=0}});
  for(uint32_t i=0;i<memory.memoryTypeCount;i++)r["memory"]["types"].push_back({{"index",i},{"heapIndex",memory.memoryTypes[i].heapIndex},{"flags",memory.memoryTypes[i].propertyFlags}});
  auto memory2=reinterpret_cast<PFN_vkGetPhysicalDeviceMemoryProperties2>(get(instance,"vkGetPhysicalDeviceMemoryProperties2"));if(!memory2)memory2=reinterpret_cast<PFN_vkGetPhysicalDeviceMemoryProperties2>(get(instance,"vkGetPhysicalDeviceMemoryProperties2KHR"));
  if(memory2&&properties2Enabled&&has(VK_EXT_MEMORY_BUDGET_EXTENSION_NAME)){VkPhysicalDeviceMemoryBudgetPropertiesEXT budget{VK_STRUCTURE_TYPE_PHYSICAL_DEVICE_MEMORY_BUDGET_PROPERTIES_EXT};VkPhysicalDeviceMemoryProperties2 m2{VK_STRUCTURE_TYPE_PHYSICAL_DEVICE_MEMORY_PROPERTIES_2};m2.pNext=&budget;memory2(d,&m2);for(uint32_t i=0;i<memory.memoryHeapCount;i++){r["memory"]["heaps"][i]["budgetBytes"]=budget.heapBudget[i];r["memory"]["heaps"][i]["usageBytes"]=budget.heapUsage[i];}}
  r["storageFormats"]=json::object();for(auto pair:{std::pair<const char*,VkFormat>{"R32_SFLOAT",VK_FORMAT_R32_SFLOAT},{"R16_SFLOAT",VK_FORMAT_R16_SFLOAT},{"R32_UINT",VK_FORMAT_R32_UINT}}){VkFormatProperties f{};fn<PFN_vkGetPhysicalDeviceFormatProperties>("vkGetPhysicalDeviceFormatProperties")(d,pair.second,&f);r["storageFormats"][pair.first]={{"storageBufferTexel",(f.bufferFeatures&VK_FORMAT_FEATURE_STORAGE_TEXEL_BUFFER_BIT)!=0},{"storageImage",(f.optimalTilingFeatures&VK_FORMAT_FEATURE_STORAGE_IMAGE_BIT)!=0}};}
  return r;
 }
};
struct Compute {
 Probe& p;VkDevice device=VK_NULL_HANDLE;VkBuffer buffer=VK_NULL_HANDLE;VkDeviceMemory memory=VK_NULL_HANDLE;VkDescriptorSetLayout layout=VK_NULL_HANDLE;VkDescriptorPool descriptors=VK_NULL_HANDLE;VkPipelineLayout pipelineLayout=VK_NULL_HANDLE;VkShaderModule shader=VK_NULL_HANDLE;VkPipeline pipeline=VK_NULL_HANDLE;VkCommandPool commands=VK_NULL_HANDLE;VkFence fence=VK_NULL_HANDLE;void* mapped=nullptr;
 explicit Compute(Probe& probe):p(probe){}
 template<class T>T fn(const char* name){auto f=p.fn<PFN_vkGetDeviceProcAddr>("vkGetDeviceProcAddr");auto value=reinterpret_cast<T>(f(device,name));if(!value)throw Failure(std::string("device-entry-point:")+name,VK_ERROR_EXTENSION_NOT_PRESENT);return value;}
 ~Compute(){if(!device)return;if(mapped)fn<PFN_vkUnmapMemory>("vkUnmapMemory")(device,memory);if(fence)fn<PFN_vkDestroyFence>("vkDestroyFence")(device,fence,nullptr);if(commands)fn<PFN_vkDestroyCommandPool>("vkDestroyCommandPool")(device,commands,nullptr);if(pipeline)fn<PFN_vkDestroyPipeline>("vkDestroyPipeline")(device,pipeline,nullptr);if(shader)fn<PFN_vkDestroyShaderModule>("vkDestroyShaderModule")(device,shader,nullptr);if(pipelineLayout)fn<PFN_vkDestroyPipelineLayout>("vkDestroyPipelineLayout")(device,pipelineLayout,nullptr);if(descriptors)fn<PFN_vkDestroyDescriptorPool>("vkDestroyDescriptorPool")(device,descriptors,nullptr);if(layout)fn<PFN_vkDestroyDescriptorSetLayout>("vkDestroyDescriptorSetLayout")(device,layout,nullptr);if(buffer)fn<PFN_vkDestroyBuffer>("vkDestroyBuffer")(device,buffer,nullptr);if(memory)fn<PFN_vkFreeMemory>("vkFreeMemory")(device,memory,nullptr);fn<PFN_vkDestroyDevice>("vkDestroyDevice")(device,nullptr);}
 void run(VkPhysicalDevice physical,uint32_t family,json& out){
  float priority=1;VkDeviceQueueCreateInfo qi{VK_STRUCTURE_TYPE_DEVICE_QUEUE_CREATE_INFO};qi.queueFamilyIndex=family;qi.queueCount=1;qi.pQueuePriorities=&priority;
  VkDeviceCreateInfo di{VK_STRUCTURE_TYPE_DEVICE_CREATE_INFO};di.queueCreateInfoCount=1;di.pQueueCreateInfos=&qi;ok(p.fn<PFN_vkCreateDevice>("vkCreateDevice")(physical,&di,nullptr,&device),"device-create");
  VkQueue queue;fn<PFN_vkGetDeviceQueue>("vkGetDeviceQueue")(device,family,0,&queue);
  VkBufferCreateInfo bi{VK_STRUCTURE_TYPE_BUFFER_CREATE_INFO};bi.size=64*3*sizeof(uint32_t);bi.usage=VK_BUFFER_USAGE_STORAGE_BUFFER_BIT;bi.sharingMode=VK_SHARING_MODE_EXCLUSIVE;ok(fn<PFN_vkCreateBuffer>("vkCreateBuffer")(device,&bi,nullptr,&buffer),"buffer-create");
  VkMemoryRequirements req{};fn<PFN_vkGetBufferMemoryRequirements>("vkGetBufferMemoryRequirements")(device,buffer,&req);VkPhysicalDeviceMemoryProperties mp{};p.fn<PFN_vkGetPhysicalDeviceMemoryProperties>("vkGetPhysicalDeviceMemoryProperties")(physical,&mp);
  uint32_t type=UINT32_MAX;for(uint32_t i=0;i<mp.memoryTypeCount;i++)if((req.memoryTypeBits&(1u<<i))&&(mp.memoryTypes[i].propertyFlags&VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT)){type=i;if(mp.memoryTypes[i].propertyFlags&VK_MEMORY_PROPERTY_HOST_COHERENT_BIT)break;}
  if(type==UINT32_MAX)throw Failure("host-visible-memory",VK_ERROR_FEATURE_NOT_PRESENT);
  // The diagnostic never allocates a model-sized buffer, even on a broken driver.
  if(req.size>1024*1024)throw Failure("memory-bound",VK_ERROR_OUT_OF_DEVICE_MEMORY);
  VkMemoryAllocateInfo ai{VK_STRUCTURE_TYPE_MEMORY_ALLOCATE_INFO};ai.allocationSize=req.size;ai.memoryTypeIndex=type;ok(fn<PFN_vkAllocateMemory>("vkAllocateMemory")(device,&ai,nullptr,&memory),"memory-allocate");ok(fn<PFN_vkBindBufferMemory>("vkBindBufferMemory")(device,buffer,memory,0),"memory-bind");ok(fn<PFN_vkMapMemory>("vkMapMemory")(device,memory,0,VK_WHOLE_SIZE,0,&mapped),"memory-map");
  auto values=static_cast<uint32_t*>(mapped);for(uint32_t i=0;i<64;i++){values[i]=i;values[64+i]=100+2*i;values[128+i]=UINT32_MAX;}
  VkMappedMemoryRange range{VK_STRUCTURE_TYPE_MAPPED_MEMORY_RANGE};range.memory=memory;range.size=VK_WHOLE_SIZE;
  bool coherent=(mp.memoryTypes[type].propertyFlags&VK_MEMORY_PROPERTY_HOST_COHERENT_BIT)!=0;if(!coherent)ok(fn<PFN_vkFlushMappedMemoryRanges>("vkFlushMappedMemoryRanges")(device,1,&range),"memory-flush");
  VkDescriptorSetLayoutBinding binding{};binding.binding=0;binding.descriptorCount=1;binding.descriptorType=VK_DESCRIPTOR_TYPE_STORAGE_BUFFER;binding.stageFlags=VK_SHADER_STAGE_COMPUTE_BIT;
  VkDescriptorSetLayoutCreateInfo li{VK_STRUCTURE_TYPE_DESCRIPTOR_SET_LAYOUT_CREATE_INFO};li.bindingCount=1;li.pBindings=&binding;ok(fn<PFN_vkCreateDescriptorSetLayout>("vkCreateDescriptorSetLayout")(device,&li,nullptr,&layout),"descriptor-layout");
  VkDescriptorPoolSize size{VK_DESCRIPTOR_TYPE_STORAGE_BUFFER,1};VkDescriptorPoolCreateInfo pool{VK_STRUCTURE_TYPE_DESCRIPTOR_POOL_CREATE_INFO};pool.maxSets=1;pool.poolSizeCount=1;pool.pPoolSizes=&size;ok(fn<PFN_vkCreateDescriptorPool>("vkCreateDescriptorPool")(device,&pool,nullptr,&descriptors),"descriptor-pool");
  VkDescriptorSetAllocateInfo alloc{VK_STRUCTURE_TYPE_DESCRIPTOR_SET_ALLOCATE_INFO};alloc.descriptorPool=descriptors;alloc.descriptorSetCount=1;alloc.pSetLayouts=&layout;VkDescriptorSet set;ok(fn<PFN_vkAllocateDescriptorSets>("vkAllocateDescriptorSets")(device,&alloc,&set),"descriptor-allocate");
  VkDescriptorBufferInfo db{buffer,0,bi.size};VkWriteDescriptorSet write{VK_STRUCTURE_TYPE_WRITE_DESCRIPTOR_SET};write.dstSet=set;write.dstBinding=0;write.descriptorCount=1;write.descriptorType=VK_DESCRIPTOR_TYPE_STORAGE_BUFFER;write.pBufferInfo=&db;fn<PFN_vkUpdateDescriptorSets>("vkUpdateDescriptorSets")(device,1,&write,0,nullptr);
  VkPipelineLayoutCreateInfo pli{VK_STRUCTURE_TYPE_PIPELINE_LAYOUT_CREATE_INFO};pli.setLayoutCount=1;pli.pSetLayouts=&layout;ok(fn<PFN_vkCreatePipelineLayout>("vkCreatePipelineLayout")(device,&pli,nullptr,&pipelineLayout),"pipeline-layout");
  VkShaderModuleCreateInfo si{VK_STRUCTURE_TYPE_SHADER_MODULE_CREATE_INFO};si.codeSize=sizeof(VECTOR_ADD_SPV);si.pCode=VECTOR_ADD_SPV;ok(fn<PFN_vkCreateShaderModule>("vkCreateShaderModule")(device,&si,nullptr,&shader),"shader-module");
  VkComputePipelineCreateInfo pi{VK_STRUCTURE_TYPE_COMPUTE_PIPELINE_CREATE_INFO};pi.layout=pipelineLayout;pi.stage.sType=VK_STRUCTURE_TYPE_PIPELINE_SHADER_STAGE_CREATE_INFO;pi.stage.stage=VK_SHADER_STAGE_COMPUTE_BIT;pi.stage.module=shader;pi.stage.pName="main";ok(fn<PFN_vkCreateComputePipelines>("vkCreateComputePipelines")(device,VK_NULL_HANDLE,1,&pi,nullptr,&pipeline),"compute-pipeline");
  VkCommandPoolCreateInfo cpi{VK_STRUCTURE_TYPE_COMMAND_POOL_CREATE_INFO};cpi.queueFamilyIndex=family;ok(fn<PFN_vkCreateCommandPool>("vkCreateCommandPool")(device,&cpi,nullptr,&commands),"command-pool");
  VkCommandBufferAllocateInfo cai{VK_STRUCTURE_TYPE_COMMAND_BUFFER_ALLOCATE_INFO};cai.commandPool=commands;cai.level=VK_COMMAND_BUFFER_LEVEL_PRIMARY;cai.commandBufferCount=1;VkCommandBuffer command;ok(fn<PFN_vkAllocateCommandBuffers>("vkAllocateCommandBuffers")(device,&cai,&command),"command-allocate");
  VkCommandBufferBeginInfo begin{VK_STRUCTURE_TYPE_COMMAND_BUFFER_BEGIN_INFO};begin.flags=VK_COMMAND_BUFFER_USAGE_ONE_TIME_SUBMIT_BIT;ok(fn<PFN_vkBeginCommandBuffer>("vkBeginCommandBuffer")(command,&begin),"command-begin");fn<PFN_vkCmdBindPipeline>("vkCmdBindPipeline")(command,VK_PIPELINE_BIND_POINT_COMPUTE,pipeline);fn<PFN_vkCmdBindDescriptorSets>("vkCmdBindDescriptorSets")(command,VK_PIPELINE_BIND_POINT_COMPUTE,pipelineLayout,0,1,&set,0,nullptr);fn<PFN_vkCmdDispatch>("vkCmdDispatch")(command,2,1,1);
  VkMemoryBarrier barrier{VK_STRUCTURE_TYPE_MEMORY_BARRIER};barrier.srcAccessMask=VK_ACCESS_SHADER_WRITE_BIT;barrier.dstAccessMask=VK_ACCESS_HOST_READ_BIT;fn<PFN_vkCmdPipelineBarrier>("vkCmdPipelineBarrier")(command,VK_PIPELINE_STAGE_COMPUTE_SHADER_BIT,VK_PIPELINE_STAGE_HOST_BIT,0,1,&barrier,0,nullptr,0,nullptr);ok(fn<PFN_vkEndCommandBuffer>("vkEndCommandBuffer")(command),"command-end");
  VkFenceCreateInfo fi{VK_STRUCTURE_TYPE_FENCE_CREATE_INFO};ok(fn<PFN_vkCreateFence>("vkCreateFence")(device,&fi,nullptr,&fence),"fence-create");VkSubmitInfo submit{VK_STRUCTURE_TYPE_SUBMIT_INFO};submit.commandBufferCount=1;submit.pCommandBuffers=&command;ok(fn<PFN_vkQueueSubmit>("vkQueueSubmit")(queue,1,&submit,fence),"queue-submit");
  VkResult waited=fn<PFN_vkWaitForFences>("vkWaitForFences")(device,1,&fence,VK_TRUE,2'000'000'000ULL);
  if(waited==VK_TIMEOUT){
   // Vulkan forbids destroying resources still in use. Exit this isolated helper;
   // OS/driver reclaim its handles. The Java watchdog also covers hung teardown.
   out["success"]=false;out["stage"]="fence-wait";out["errorCode"]="vulkan-timeout";out["vkResult"]=waited;std::cout<<out.dump()<<std::endl;std::_Exit(2);
  }
  ok(waited,"fence-wait");if(!coherent)ok(fn<PFN_vkInvalidateMappedMemoryRanges>("vkInvalidateMappedMemoryRanges")(device,1,&range),"memory-invalidate");
#ifdef CALENDAR_TEST_CORRUPT_RESULT
  values[128]^=1;
#endif
  for(uint32_t i=0;i<64;i++)if(values[128+i]!=100+3*i)throw Failure("result-verify",VK_ERROR_VALIDATION_FAILED_EXT);
  out["compute"]={{"verified",true},{"elements",64},{"bufferBytes",bi.size},{"allocationBytes",req.size},{"queueFamily",family}};
 }
};
int main(int argc,char** argv){
 auto started=std::chrono::steady_clock::now();json out={{"version",1},{"probeVersion","beta6-v1"},{"success",false},{"stage","arguments"},{"physicalDevices",json::array()}};
 bool compute=argc==2&&!strcmp(argv[1],"--compute");if(argc!=2||(!compute&&strcmp(argv[1],"--discover"))){out["errorCode"]="vulkan-invalid-arguments";std::cout<<out.dump()<<std::endl;return 2;}
 try{
  Probe probe;probe.open(out);auto devices=probe.devices();VkPhysicalDevice selected=VK_NULL_HANDLE;uint32_t family=0;bool hardwareSelected=false;
  for(auto d:devices){auto r=probe.describe(d);out["physicalDevices"].push_back(r);auto q=probe.queues(d);for(uint32_t i=0;i<q.size();i++)if(q[i].queueCount&&(q[i].queueFlags&VK_QUEUE_COMPUTE_BIT)){bool hw=r["deviceType"]=="integrated"||r["deviceType"]=="discrete";if(!selected||(hw&&!hardwareSelected)){selected=d;family=i;hardwareSelected=hw;out["selectedDevice"]=r;}break;}}
  out["hardwareGpuDetected"]=std::any_of(out["physicalDevices"].begin(),out["physicalDevices"].end(),[](const json& d){return d["deviceType"]=="integrated"||d["deviceType"]=="discrete";});
  out["computeQueueAvailable"]=selected!=VK_NULL_HANDLE;
  if(devices.empty())throw Failure("devices-empty",VK_ERROR_INITIALIZATION_FAILED);
  if(compute){if(!selected)throw Failure("compute-queue",VK_ERROR_FEATURE_NOT_PRESENT);Compute test(probe);test.run(selected,family,out);}
  out["success"]=true;out["stage"]=compute?"result-verified":"discovered";
 }catch(const Failure& e){out["stage"]=e.stage;out["vkResult"]=e.result;out["errorCode"]=e.stage=="result-verify"?"vulkan-result-mismatch":"vulkan-probe-failed";}catch(...){out["stage"]="native-exception";out["errorCode"]="vulkan-native-exception";}
 out["durationMs"]=elapsed(started);std::cout<<out.dump(-1,' ',false,json::error_handler_t::replace)<<std::endl;return out["success"]==true?0:2;
}
